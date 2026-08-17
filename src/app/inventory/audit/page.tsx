import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrManager } from "@/lib/auth";
import { Badge, Card, DataTable, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventoryAuditPage() {
  await requireOwnerOrManager();
  const logs = await prisma.inventoryAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div>
      <PageHeader
        title="Inventory Audit Log"
        description="Append-only security trail. Employees cannot erase entries from the application."
        actions={
          <Link href="/inventory/security" className="text-sm text-[var(--gold-deep)] hover:underline">
            Security hub
          </Link>
        }
      />
      <Card title="Audit events">
        {logs.length === 0 ? (
          <EmptyState title="No audit events" description="Adjustments, transfers, counts, and RFID scans log here." />
        ) : (
          <DataTable headers={["When", "Severity", "Action", "Summary", "Actor", "Approver"]}>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-3 text-xs whitespace-nowrap">{l.createdAt.toLocaleString()}</td>
                <td className="px-3 py-3">
                  <Badge
                    tone={
                      l.severity === "CRITICAL" ? "danger" : l.severity === "WARN" ? "warn" : "neutral"
                    }
                  >
                    {l.severity}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-xs">{l.action}</td>
                <td className="px-3 py-3">
                  {l.summary}
                  {l.detail ? <p className="text-xs text-[var(--muted)]">{l.detail}</p> : null}
                </td>
                <td className="px-3 py-3 text-xs">{l.actorName || "—"}</td>
                <td className="px-3 py-3 text-xs">{l.approverName || "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
