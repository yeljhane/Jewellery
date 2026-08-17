"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireOwnerOrManager, requireRole } from "@/lib/auth";
import { nextSerialNumber } from "@/lib/data";
import {
  getInventorySecurityAlerts,
  nextCountNumber,
  nextTransferNumber,
  recordStockMovement,
  verifyDualAuthorizer,
  writeInventoryAudit,
} from "@/lib/inventory-security";

function revalidateInventorySecurity() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/serials");
  revalidatePath("/inventory/security");
  revalidatePath("/inventory/locations");
  revalidatePath("/inventory/movements");
  revalidatePath("/inventory/transfers");
  revalidatePath("/inventory/counts");
  revalidatePath("/inventory/audit");
}

export async function createStockLocation(formData: FormData) {
  await requireOwnerOrManager();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Location name is required.");
  await prisma.stockLocation.create({
    data: {
      name,
      kind: String(formData.get("kind") || "SHOWCASE"),
      description: String(formData.get("description") || "").trim() || null,
    },
  });
  revalidateInventorySecurity();
}

export async function createInventorySerialSecure(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const productId = String(formData.get("productId") || "");
  if (!productId) throw new Error("Product is required.");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found.");

  const serialRaw = String(formData.get("serialNumber") || "").trim();
  const serialNumber = serialRaw || (await nextSerialNumber());
  const rfidTag = String(formData.get("rfidTag") || "").trim() || null;
  const locationId = String(formData.get("locationId") || "").trim() || null;
  const qty = Math.max(1, Math.floor(Number(formData.get("quantity") || 1)));

  for (let i = 0; i < qty; i++) {
    const sn = qty === 1 ? serialNumber : `${serialNumber}-${i + 1}`;
    const tag = qty === 1 ? rfidTag : rfidTag ? `${rfidTag}-${i + 1}` : null;
    const item = await prisma.inventoryItem.create({
      data: {
        serialNumber: sn,
        rfidTag: tag,
        productId,
        locationId,
        status: "IN_STOCK",
        locationNote: String(formData.get("locationNote") || "").trim() || null,
        costPrice: Number(formData.get("costPrice") || product.costPrice || 0) || null,
        notes: String(formData.get("notes") || "").trim() || null,
      },
    });
    await recordStockMovement({
      inventoryItemId: item.id,
      productId,
      movementType: "CREATE",
      quantityDelta: 1,
      toLocationId: locationId,
      note: `Registered serial ${sn}`,
      actorId: session.user.employeeId,
      actorName: session.user.name,
    });
  }

  const serialCount = await prisma.inventoryItem.count({
    where: { productId, status: "IN_STOCK" },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      quantity: Math.max(product.quantity, serialCount),
      status: "IN_STOCK",
    },
  });

  await writeInventoryAudit({
    action: "CREATE",
    summary: `Registered ${qty} serial(s) for ${product.sku}`,
    actorId: session.user.employeeId,
    actorName: session.user.name,
    entityType: "Product",
    entityId: productId,
  });

  revalidateInventorySecurity();
}

export async function adjustInventoryItem(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER"]);
  const itemId = String(formData.get("inventoryItemId") || "");
  const newStatus = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim();
  if (!itemId || !newStatus) throw new Error("Item and status are required.");

  const settings = await prisma.shopSettings.findFirst();
  let approver: { id: string; name: string } | null = null;
  if (settings?.dualAuthAdjustments !== false) {
    approver = await verifyDualAuthorizer({
      requesterId: session.user.employeeId,
      username: String(formData.get("approverUsername") || ""),
      password: String(formData.get("approverPassword") || ""),
    });
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { product: true },
  });
  if (!item) throw new Error("Serial not found.");

  const prev = item.status;
  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      status: newStatus,
      locationId: String(formData.get("locationId") || "").trim() || item.locationId,
    },
  });

  await recordStockMovement({
    inventoryItemId: item.id,
    productId: item.productId,
    movementType: "ADJUST",
    quantityDelta: 0,
    note: note || `Status ${prev} → ${newStatus}`,
    actorId: session.user.employeeId,
    actorName: session.user.name,
  });

  await writeInventoryAudit({
    action: "ADJUST",
    severity: newStatus === "MISSING" ? "CRITICAL" : "WARN",
    summary: `Adjusted ${item.serialNumber}: ${prev} → ${newStatus}`,
    detail: note || null,
    entityType: "InventoryItem",
    entityId: item.id,
    actorId: session.user.employeeId,
    actorName: session.user.name,
    approverId: approver?.id,
    approverName: approver?.name,
  });

  revalidateInventorySecurity();
}

export async function requestStockTransfer(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const fromLocationId = String(formData.get("fromLocationId") || "");
  const toLocationId = String(formData.get("toLocationId") || "");
  const inventoryItemId = String(formData.get("inventoryItemId") || "").trim() || null;
  if (!fromLocationId || !toLocationId) throw new Error("From and to locations are required.");
  if (fromLocationId === toLocationId) throw new Error("Locations must differ.");

  const transferNumber = await nextTransferNumber();
  const item = inventoryItemId
    ? await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } })
    : null;

  const transfer = await prisma.stockTransfer.create({
    data: {
      transferNumber,
      fromLocationId,
      toLocationId,
      requestedById: session.user.employeeId,
      requestedByName: session.user.name || null,
      notes: String(formData.get("notes") || "").trim() || null,
      status: "PENDING",
      items: {
        create: item
          ? [
              {
                inventoryItemId: item.id,
                productId: item.productId,
                serialNumber: item.serialNumber,
                quantity: 1,
              },
            ]
          : [],
      },
    },
  });

  await writeInventoryAudit({
    action: "TRANSFER_REQUEST",
    summary: `Transfer ${transferNumber} requested`,
    entityType: "StockTransfer",
    entityId: transfer.id,
    actorId: session.user.employeeId,
    actorName: session.user.name,
  });

  revalidateInventorySecurity();
  redirect(`/inventory/transfers`);
}

export async function approveStockTransfer(formData: FormData) {
  const session = await requireOwnerOrManager();
  const id = String(formData.get("id") || "");
  const settings = await prisma.shopSettings.findFirst();
  let approver = { id: session.user.employeeId, name: session.user.name || "Manager" };

  if (settings?.dualAuthTransfers !== false) {
    const dual = await verifyDualAuthorizer({
      requesterId: session.user.employeeId,
      username: String(formData.get("approverUsername") || ""),
      password: String(formData.get("approverPassword") || ""),
    });
    approver = { id: dual.id, name: dual.name };
  }

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!transfer || transfer.status !== "PENDING") {
    throw new Error("Transfer is not pending approval.");
  }

  await prisma.stockTransfer.update({
    where: { id },
    data: {
      status: "IN_TRANSIT",
      approvedById: approver.id,
      approvedByName: approver.name,
      approvedAt: new Date(),
    },
  });

  for (const line of transfer.items) {
    if (!line.inventoryItemId) continue;
    await prisma.inventoryItem.update({
      where: { id: line.inventoryItemId },
      data: { status: "IN_TRANSIT" },
    });
    await recordStockMovement({
      inventoryItemId: line.inventoryItemId,
      productId: line.productId,
      movementType: "TRANSFER_OUT",
      fromLocationId: transfer.fromLocationId,
      toLocationId: transfer.toLocationId,
      referenceType: "StockTransfer",
      referenceId: transfer.id,
      actorId: session.user.employeeId,
      actorName: session.user.name,
    });
  }

  await writeInventoryAudit({
    action: "TRANSFER_APPROVE",
    severity: "WARN",
    summary: `Transfer ${transfer.transferNumber} approved → in transit`,
    entityType: "StockTransfer",
    entityId: transfer.id,
    actorId: session.user.employeeId,
    actorName: session.user.name,
    approverId: approver.id,
    approverName: approver.name,
  });

  revalidateInventorySecurity();
}

export async function confirmStockTransfer(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const id = String(formData.get("id") || "");
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!transfer || transfer.status !== "IN_TRANSIT") {
    throw new Error("Transfer is not awaiting confirmation.");
  }

  await prisma.stockTransfer.update({
    where: { id },
    data: {
      status: "COMPLETED",
      confirmedById: session.user.employeeId,
      confirmedByName: session.user.name || null,
      completedAt: new Date(),
    },
  });

  for (const line of transfer.items) {
    if (!line.inventoryItemId) continue;
    await prisma.inventoryItem.update({
      where: { id: line.inventoryItemId },
      data: {
        status: "IN_STOCK",
        locationId: transfer.toLocationId,
      },
    });
    await recordStockMovement({
      inventoryItemId: line.inventoryItemId,
      productId: line.productId,
      movementType: "TRANSFER_IN",
      fromLocationId: transfer.fromLocationId,
      toLocationId: transfer.toLocationId,
      referenceType: "StockTransfer",
      referenceId: transfer.id,
      actorId: session.user.employeeId,
      actorName: session.user.name,
    });
  }

  await writeInventoryAudit({
    action: "TRANSFER_CONFIRM",
    summary: `Transfer ${transfer.transferNumber} confirmed at destination`,
    entityType: "StockTransfer",
    entityId: transfer.id,
    actorId: session.user.employeeId,
    actorName: session.user.name,
  });

  revalidateInventorySecurity();
}

export async function rejectStockTransfer(formData: FormData) {
  const session = await requireOwnerOrManager();
  const id = String(formData.get("id") || "");
  const transfer = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!transfer || !["PENDING", "IN_TRANSIT"].includes(transfer.status)) {
    throw new Error("Transfer cannot be rejected.");
  }
  await prisma.stockTransfer.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  await writeInventoryAudit({
    action: "TRANSFER_REJECT",
    severity: "WARN",
    summary: `Transfer ${transfer.transferNumber} rejected`,
    entityType: "StockTransfer",
    entityId: id,
    actorId: session.user.employeeId,
    actorName: session.user.name,
  });
  revalidateInventorySecurity();
}

export async function startStockCount(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const locationId = String(formData.get("locationId") || "").trim() || null;
  const countNumber = await nextCountNumber();

  const items = await prisma.inventoryItem.findMany({
    where: {
      status: { in: ["IN_STOCK", "RESERVED"] },
      ...(locationId ? { locationId } : {}),
    },
    take: 500,
  });

  const count = await prisma.stockCount.create({
    data: {
      countNumber,
      locationId,
      countedById: session.user.employeeId,
      countedByName: session.user.name || null,
      notes: String(formData.get("notes") || "").trim() || null,
      status: "OPEN",
      lines: {
        create: items.map((item) => ({
          inventoryItemId: item.id,
          productId: item.productId,
          serialNumber: item.serialNumber,
          expectedStatus: item.status,
          countedPresent: false,
        })),
      },
    },
  });

  await writeInventoryAudit({
    action: "COUNT",
    summary: `Stock count ${countNumber} started (${items.length} pieces)`,
    entityType: "StockCount",
    entityId: count.id,
    actorId: session.user.employeeId,
    actorName: session.user.name,
  });

  revalidateInventorySecurity();
  redirect(`/inventory/counts/${count.id}`);
}

export async function submitStockCount(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const id = String(formData.get("id") || "");
  const count = await prisma.stockCount.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!count || count.status !== "OPEN") throw new Error("Count is not open.");

  const presentIds = new Set(
    formData.getAll("present").map((v) => String(v)).filter(Boolean)
  );

  for (const line of count.lines) {
    const present = presentIds.has(line.id);
    await prisma.stockCountLine.update({
      where: { id: line.id },
      data: { countedPresent: present },
    });

    if (!present && line.inventoryItemId) {
      await prisma.inventoryItem.update({
        where: { id: line.inventoryItemId },
        data: { status: "MISSING" },
      });
      await recordStockMovement({
        inventoryItemId: line.inventoryItemId,
        productId: line.productId,
        movementType: "COUNT",
        note: `Missing on count ${count.countNumber}`,
        referenceType: "StockCount",
        referenceId: count.id,
        actorId: session.user.employeeId,
        actorName: session.user.name,
      });
      await writeInventoryAudit({
        action: "ALERT",
        severity: "CRITICAL",
        summary: `Missing piece ${line.serialNumber} on count ${count.countNumber}`,
        entityType: "InventoryItem",
        entityId: line.inventoryItemId,
        actorId: session.user.employeeId,
        actorName: session.user.name,
      });
    } else if (present && line.inventoryItemId) {
      await recordStockMovement({
        inventoryItemId: line.inventoryItemId,
        productId: line.productId,
        movementType: "COUNT",
        note: `Verified on count ${count.countNumber}`,
        referenceType: "StockCount",
        referenceId: count.id,
        actorId: session.user.employeeId,
        actorName: session.user.name,
      });
    }
  }

  await prisma.stockCount.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await writeInventoryAudit({
    action: "COUNT",
    summary: `Stock count ${count.countNumber} completed`,
    entityType: "StockCount",
    entityId: id,
    actorId: session.user.employeeId,
    actorName: session.user.name,
  });

  revalidateInventorySecurity();
  redirect("/inventory/counts");
}

export async function rfidLookupOrScan(formData: FormData) {
  const session = await requireAuth();
  const tag = String(formData.get("rfidTag") || "").trim();
  if (!tag) throw new Error("RFID tag is required.");

  const item = await prisma.inventoryItem.findFirst({
    where: {
      OR: [{ rfidTag: tag }, { serialNumber: tag }],
    },
    include: { product: true, location: true },
  });

  if (!item) {
    await writeInventoryAudit({
      action: "RFID",
      severity: "WARN",
      summary: `RFID/serial scan miss: ${tag}`,
      actorId: session.user.employeeId,
      actorName: session.user.name,
    });
    throw new Error(`No piece found for tag/serial ${tag}.`);
  }

  await recordStockMovement({
    inventoryItemId: item.id,
    productId: item.productId,
    movementType: "RFID_SCAN",
    note: `Scanned ${tag}`,
    actorId: session.user.employeeId,
    actorName: session.user.name,
  });

  await writeInventoryAudit({
    action: "RFID",
    summary: `RFID scan OK: ${item.serialNumber} (${item.product.sku})`,
    entityType: "InventoryItem",
    entityId: item.id,
    actorId: session.user.employeeId,
    actorName: session.user.name,
  });

  revalidateInventorySecurity();
  redirect(`/inventory/serials?q=${encodeURIComponent(item.serialNumber)}`);
}

export async function loadSecurityAlerts() {
  await requireOwnerOrManager();
  return getInventorySecurityAlerts();
}
