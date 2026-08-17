import Link from "next/link";
import { getInventorySecurityAlerts } from "@/lib/inventory-security";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrManager } from "@/lib/auth";
import { rfidLookupOrScan } from "@/lib/inventory-security-actions";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventorySecurityPage() {
  await requireOwnerOrManager();
  const [alerts, serialCount, missingCount, pendingTransfers, locations] = await Promise.all([
    getInventorySecurityAlerts(),
    prisma.inventoryItem.count(),
    prisma.inventoryItem.count({ where: { status: "MISSING" } }),
    prisma.stockTransfer.count({
      where: { status: { in: ["PENDING", "APPROVED", "IN_TRANSIT"] } },
    }),
    prisma.stockLocation.count({ where: { active: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Inventory Security"
        description="Piece tracking, dual authorization, counts, transfers, and immutable audit."
        actions={
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/inventory/locations" className="text-[var(--gold-deep)] hover:underline">
              Locations
            </Link>
            <Link href="/inventory/movements" className="text-[var(--gold-deep)] hover:underline">
              Movements
            </Link>
            <Link href="/inventory/transfers" className="text-[var(--gold-deep)] hover:underline">
              Transfers
            </Link>
            <Link href="/inventory/counts" className="text-[var(--gold-deep)] hover:underline">
              Counts
            </Link>
            <Link href="/inventory/audit" className="text-[var(--gold-deep)] hover:underline">
              Audit log
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tracked pieces" value={String(serialCount)} hint="Serialized items" accent />
        <StatCard label="Locations" value={String(locations)} hint="Showcase / safe / vault" />
        <StatCard label="Open transfers" value={String(pendingTransfers)} hint="Awaiting approve/confirm" />
        <StatCard label="Missing" value={String(missingCount)} hint="Flagged from counts/adjust" />
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card title="RFID / serial scan">
          <form action={rfidLookupOrScan} className="flex flex-wrap gap-2">
            <Input name="rfidTag" placeholder="Scan RFID or type serial…" className="min-w-[220px] flex-1" />
            <Button type="submit">Lookup</Button>
          </form>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Records an RFID_SCAN movement and opens the matching piece.
          </p>
        </Card>

        <Card title="Security links">
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/inventory/serials" className="text-[var(--gold-deep)] hover:underline">
                Register / browse serials
              </Link>
            </li>
            <li>
              <Link href="/inventory/counts" className="text-[var(--gold-deep)] hover:underline">
                Start showcase / safe stock count
              </Link>
            </li>
            <li>
              <Link href="/settings" className="text-[var(--gold-deep)] hover:underline">
                Dual-auth settings
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card title="Unusual adjustments (14d)" action={<Badge tone="warn">Alerts</Badge>}>
          {alerts.unusualAdjustments.length === 0 ? (
            <EmptyState title="No unusual adjustments" description="No large or missing-tagged adjusts recently." />
          ) : (
            <DataTable headers={["When", "Piece / SKU", "Note"]}>
              {alerts.unusualAdjustments.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 text-xs">{m.createdAt.toLocaleString()}</td>
                  <td className="px-3 py-3">
                    {m.inventoryItem?.serialNumber || m.product?.sku || "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">{m.note || "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Missing items" action={<Badge tone="danger">{alerts.missingItems.length}</Badge>}>
          {alerts.missingItems.length === 0 ? (
            <EmptyState title="No missing pieces" description="Nothing is currently flagged MISSING." />
          ) : (
            <DataTable headers={["Serial", "Product", "Location"]}>
              {alerts.missingItems.map((i) => (
                <tr key={i.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{i.serialNumber}</td>
                  <td className="px-3 py-3">{i.product.sku}</td>
                  <td className="px-3 py-3">{i.location?.name || i.locationNote || "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <Card title="Recent security warnings">
        {alerts.recentCritical.length === 0 ? (
          <EmptyState title="Quiet" description="No WARN/CRITICAL audit events in the last 14 days." />
        ) : (
          <DataTable headers={["When", "Severity", "Summary", "Actor"]}>
            {alerts.recentCritical.map((a) => (
              <tr key={a.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-3 text-xs">{a.createdAt.toLocaleString()}</td>
                <td className="px-3 py-3">
                  <Badge tone={a.severity === "CRITICAL" ? "danger" : "warn"}>{a.severity}</Badge>
                </td>
                <td className="px-3 py-3">{a.summary}</td>
                <td className="px-3 py-3 text-xs">{a.actorName || "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
