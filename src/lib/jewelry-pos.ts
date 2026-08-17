import { prisma } from "@/lib/prisma";
import { recordStockMovement } from "@/lib/inventory-security";

export async function accrueSaleCommission(
  saleId: string,
  employeeId: string | null,
  saleAmount: number,
  voidOnly = false
) {
  await prisma.commissionEntry.deleteMany({ where: { saleId } });
  if (voidOnly || !employeeId || saleAmount <= 0) return;

  const [employee, settings] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.shopSettings.findFirst(),
  ]);
  if (!employee) return;

  const ratePct =
    employee.commissionPct != null ? employee.commissionPct : (settings?.commissionPct ?? 1);
  if (ratePct <= 0) return;

  const amount = (saleAmount * ratePct) / 100;
  await prisma.commissionEntry.create({
    data: {
      employeeId,
      saleId,
      saleAmount,
      ratePct,
      amount,
      status: "ACCRUED",
    },
  });
}

export async function markSerialsSold(
  items: Array<{ inventoryItemId?: string | null }>,
  restore: boolean
) {
  for (const item of items) {
    if (!item.inventoryItemId) continue;
    const row = await prisma.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
    if (!row) continue;
    const nextStatus = restore ? "IN_STOCK" : "SOLD";
    await prisma.inventoryItem.update({
      where: { id: item.inventoryItemId },
      data: { status: nextStatus },
    });
    await recordStockMovement({
      inventoryItemId: row.id,
      productId: row.productId,
      movementType: restore ? "RETURN" : "SALE",
      quantityDelta: restore ? 1 : -1,
      note: `Serial ${row.serialNumber} → ${nextStatus}`,
    });
  }
}
