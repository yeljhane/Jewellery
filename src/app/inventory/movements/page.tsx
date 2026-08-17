import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, DataTable, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StockMovementsPage() {
  await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const movements = await prisma.stockMovement.findMany({
    include: { inventoryItem: true, product: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Movement History"
        description="Complete piece and SKU movement ledger — sales, transfers, counts, RFID, adjustments."
        actions={
          <Link href="/inventory/security" className="text-sm text-[var(--gold-deep)] hover:underline">
            Security hub
          </Link>
        }
      />
      <Card title="Recent movements">
        {movements.length === 0 ? (
          <EmptyState title="No movements yet" description="Sales, transfers, and counts will appear here." />
        ) : (
          <DataTable headers={["When", "Type", "Serial / SKU", "Δ Qty", "Actor", "Note"]}>
            {movements.map((m) => (
              <tr key={m.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-3 text-xs">{m.createdAt.toLocaleString()}</td>
                <td className="px-3 py-3 font-medium">{m.movementType}</td>
                <td className="px-3 py-3">
                  {m.inventoryItem?.serialNumber || m.product?.sku || "—"}
                </td>
                <td className="px-3 py-3">{m.quantityDelta}</td>
                <td className="px-3 py-3 text-xs">{m.actorName || "—"}</td>
                <td className="px-3 py-3 text-xs text-[var(--muted)]">{m.note || "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
