import Link from "next/link";
import { startStockCount } from "@/lib/inventory-security-actions";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function StockCountsPage() {
  await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const [locations, counts] = await Promise.all([
    prisma.stockLocation.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.stockCount.findMany({
      include: { location: true, _count: { select: { lines: true } } },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Stock Counts"
        description="Count by showcase, safe, or vault. Unchecked pieces are flagged MISSING."
        actions={
          <Link href="/inventory/security" className="text-sm text-[var(--gold-deep)] hover:underline">
            Security hub
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Start count" className="lg:col-span-1">
          <ActionForm action={startStockCount} successMessage="The stock count was started successfully." className="space-y-3">
            <Select label="Location" name="locationId" defaultValue="">
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.kind})
                </option>
              ))}
            </Select>
            <Textarea label="Notes" name="notes" rows={2} />
            <Button type="submit">Start count</Button>
          </ActionForm>
        </Card>
        <Card title="Count history" className="lg:col-span-2">
          {counts.length === 0 ? (
            <EmptyState title="No counts yet" description="Start a location count to verify every piece." />
          ) : (
            <DataTable headers={["Count", "Location", "Lines", "Status", ""]}>
              {counts.map((c) => (
                <tr key={c.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{c.countNumber}</td>
                  <td className="px-3 py-3">{c.location?.name || "All"}</td>
                  <td className="px-3 py-3">{c._count.lines}</td>
                  <td className="px-3 py-3">
                    <Badge tone={c.status === "COMPLETED" ? "success" : "warn"}>{c.status}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/inventory/counts/${c.id}`} className="text-[var(--gold-deep)] hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
