import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateNumber } from "@/lib/utils";

export async function writeInventoryAudit(input: {
  action: string;
  summary: string;
  detail?: string | null;
  severity?: "INFO" | "WARN" | "CRITICAL";
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  approverId?: string | null;
  approverName?: string | null;
}) {
  await prisma.inventoryAuditLog.create({
    data: {
      action: input.action,
      summary: input.summary,
      detail: input.detail ?? null,
      severity: input.severity ?? "INFO",
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      approverId: input.approverId ?? null,
      approverName: input.approverName ?? null,
    },
  });
}

export async function recordStockMovement(input: {
  inventoryItemId?: string | null;
  productId?: string | null;
  movementType: string;
  quantityDelta?: number;
  qtyBefore?: number | null;
  qtyAfter?: number | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}) {
  await prisma.stockMovement.create({
    data: {
      inventoryItemId: input.inventoryItemId ?? null,
      productId: input.productId ?? null,
      movementType: input.movementType,
      quantityDelta: input.quantityDelta ?? 0,
      qtyBefore: input.qtyBefore ?? null,
      qtyAfter: input.qtyAfter ?? null,
      fromLocationId: input.fromLocationId ?? null,
      toLocationId: input.toLocationId ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      note: input.note ?? null,
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
    },
  });
}

/** Throws if sale would drive product qty below zero. */
export function assertNonNegativeStock(currentQty: number, deltaOut: number, label: string) {
  if (deltaOut > currentQty) {
    throw new Error(
      `Negative stock blocked for ${label}: on hand ${currentQty}, requested ${deltaOut}.`
    );
  }
}

export async function verifyDualAuthorizer(input: {
  requesterId: string;
  username: string;
  password: string;
  requireManager?: boolean;
}) {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password) {
    throw new Error("Approver username and password are required for dual authorization.");
  }

  const approver = await prisma.employee.findFirst({
    where: { username, active: true },
  });
  if (!approver?.passwordHash) {
    throw new Error("Approver credentials are invalid.");
  }
  if (approver.id === input.requesterId) {
    throw new Error("Dual authorization requires a different employee.");
  }
  if (input.requireManager !== false) {
    if (approver.role !== "OWNER" && approver.role !== "MANAGER") {
      throw new Error("Approver must be Owner or Manager.");
    }
  }

  const ok = await bcrypt.compare(input.password, approver.passwordHash);
  if (!ok) throw new Error("Approver credentials are invalid.");

  return { id: approver.id, name: approver.name, role: approver.role };
}

export async function nextTransferNumber() {
  const count = await prisma.stockTransfer.count();
  return generateNumber("TRF", count + 1);
}

export async function nextCountNumber() {
  const count = await prisma.stockCount.count();
  return generateNumber("CNT", count + 1);
}

export async function getInventorySecurityAlerts() {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [recentAdjustments, missingItems, openTransfers, recentCritical] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        movementType: "ADJUST",
        createdAt: { gte: since },
      },
      include: { product: true, inventoryItem: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.inventoryItem.findMany({
      where: { status: "MISSING" },
      include: { product: true, location: true },
      take: 50,
    }),
    prisma.stockTransfer.findMany({
      where: { status: { in: ["PENDING", "APPROVED", "IN_TRANSIT"] } },
      include: { fromLocation: true, toLocation: true },
      orderBy: { requestedAt: "desc" },
      take: 20,
    }),
    prisma.inventoryAuditLog.findMany({
      where: { severity: { in: ["WARN", "CRITICAL"] }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const unusualAdjustments = recentAdjustments.filter(
    (m) => Math.abs(m.quantityDelta) >= 3 || (m.note || "").toLowerCase().includes("missing")
  );

  return {
    unusualAdjustments,
    missingItems,
    openTransfers,
    recentCritical,
  };
}
