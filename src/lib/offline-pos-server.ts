import { prisma } from "@/lib/prisma";
import { syncOfflineSale } from "@/lib/actions";

export type OfflineSaleEnvelope = {
  clientTxnId: string;
  deviceId?: string;
  queuedAt: string;
  fields: Record<string, string>;
};

type SyncResult = {
  status: "SYNCED" | "CONFLICT" | "FAILED";
  saleId?: string;
  invoiceNumber?: string;
  conflictCode?: string;
  message?: string;
};

let syncChain: Promise<unknown> = Promise.resolve();

function serializeSync<T>(operation: () => Promise<T>) {
  const run = syncChain.then(operation, operation);
  syncChain = run.then(() => undefined, () => undefined);
  return run;
}

function toFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

async function stockConflicts(envelope: OfflineSaleEnvelope) {
  let items: Array<{ productId?: string | null; quantity?: number; description?: string }> = [];
  try {
    items = JSON.parse(envelope.fields.itemsJson || "[]");
  } catch {
    return [{ code: "INVALID_CART", message: "The queued cart data is invalid." }];
  }

  const requested = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    requested.set(item.productId, (requested.get(item.productId) || 0) + Math.max(1, Number(item.quantity) || 1));
  }
  if (requested.size === 0) return [];

  const products = await prisma.product.findMany({ where: { id: { in: [...requested.keys()] } } });
  const byId = new Map(products.map((product) => [product.id, product]));
  const conflicts: Array<{ code: string; message: string }> = [];
  for (const [productId, quantity] of requested) {
    const product = byId.get(productId);
    if (!product) {
      conflicts.push({ code: "ITEM_MISSING", message: `Stock item ${productId} no longer exists.` });
    } else if (product.status !== "IN_STOCK" || product.quantity < quantity) {
      conflicts.push({
        code: "STOCK_CHANGED",
        message: `${product.sku} needs ${quantity}, but only ${Math.max(0, product.quantity)} is available.`,
      });
    }
  }
  return conflicts;
}

export async function processOfflineSale(envelope: OfflineSaleEnvelope, retry = false): Promise<SyncResult> {
  return serializeSync(async () => {
    const existing = await prisma.offlinePosTransaction.findUnique({ where: { clientTxnId: envelope.clientTxnId } });
    const alreadyCreatedSale = await prisma.sale.findUnique({ where: { offlineClientTxnId: envelope.clientTxnId } });
    if (alreadyCreatedSale) {
      if (existing) {
        await prisma.offlinePosTransaction.update({
          where: { id: existing.id },
          data: { status: "SYNCED", saleId: alreadyCreatedSale.id, syncedAt: existing.syncedAt || new Date(), lastError: null },
        });
      }
      return { status: "SYNCED", saleId: alreadyCreatedSale.id, invoiceNumber: alreadyCreatedSale.invoiceNumber };
    }
    if (existing?.status === "SYNCED" && existing.saleId) {
      const sale = await prisma.sale.findUnique({ where: { id: existing.saleId } });
      return { status: "SYNCED", saleId: existing.saleId, invoiceNumber: sale?.invoiceNumber };
    }
    if (existing?.status === "DISCARDED") return { status: "FAILED", message: "This queued sale was discarded." };
    if (existing?.status === "CONFLICT" && !retry) {
      return { status: "CONFLICT", conflictCode: existing.conflictCode || "CONFLICT", message: existing.conflictDetails || "Review required." };
    }

    const queuedAt = new Date(envelope.queuedAt);
    const transaction = existing
      ? await prisma.offlinePosTransaction.update({
          where: { id: existing.id },
          data: { status: "SYNCING", attempts: { increment: 1 }, lastError: null },
        })
      : await prisma.offlinePosTransaction.create({
          data: {
            clientTxnId: envelope.clientTxnId,
            deviceId: envelope.deviceId || null,
            payload: JSON.stringify(envelope),
            status: "SYNCING",
            queuedAt: Number.isNaN(queuedAt.getTime()) ? new Date() : queuedAt,
            attempts: 1,
          },
        });

    const conflicts = await stockConflicts(envelope);
    if (conflicts.length > 0) {
      const details = conflicts.map((conflict) => conflict.message).join("\n");
      await prisma.offlinePosTransaction.update({
        where: { id: transaction.id },
        data: { status: "CONFLICT", conflictCode: conflicts[0].code, conflictDetails: details, lastError: details },
      });
      return { status: "CONFLICT", conflictCode: conflicts[0].code, message: details };
    }

    try {
      const formData = toFormData(envelope.fields);
      formData.set("offlineClientTxnId", envelope.clientTxnId);
      const sale = await syncOfflineSale(formData);
      await prisma.offlinePosTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "SYNCED",
          saleId: sale.id,
          syncedAt: new Date(),
          conflictCode: null,
          conflictDetails: null,
          lastError: null,
          resolution: retry ? "RETRIED" : null,
          resolvedAt: retry ? new Date() : null,
        },
      });
      return { status: "SYNCED", saleId: sale.id, invoiceNumber: sale.invoiceNumber };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Offline sale synchronization failed.";
      const conflict = /stock|available|sold|serial/i.test(message);
      await prisma.offlinePosTransaction.update({
        where: { id: transaction.id },
        data: {
          status: conflict ? "CONFLICT" : "FAILED",
          conflictCode: conflict ? "STOCK_CHANGED" : null,
          conflictDetails: conflict ? message : null,
          lastError: message,
        },
      });
      return { status: conflict ? "CONFLICT" : "FAILED", conflictCode: conflict ? "STOCK_CHANGED" : undefined, message };
    }
  });
}
