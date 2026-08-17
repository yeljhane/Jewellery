import { createStockLocation } from "@/lib/inventory-security-actions";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrManager } from "@/lib/auth";
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StockLocationsPage() {
  await requireOwnerOrManager();
  const locations = await prisma.stockLocation.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Stock Locations"
        description="Showcase, safe, vault, and counter locations for piece-level counts and transfers."
        actions={
          <Link href="/inventory/security" className="text-sm text-[var(--gold-deep)] hover:underline">
            Security hub
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Add location" className="lg:col-span-1">
          <form action={createStockLocation} className="space-y-3">
            <Input label="Name" name="name" required placeholder="Main showcase A" />
            <Select label="Kind" name="kind" defaultValue="SHOWCASE">
              <option value="SHOWCASE">Showcase</option>
              <option value="SAFE">Safe</option>
              <option value="VAULT">Vault</option>
              <option value="COUNTER">Counter</option>
              <option value="OTHER">Other</option>
            </Select>
            <Textarea label="Description" name="description" rows={2} />
            <Button type="submit">Save location</Button>
          </form>
        </Card>
        <Card title="Directory" className="lg:col-span-2">
          {locations.length === 0 ? (
            <EmptyState title="No locations" description="Add showcase and safe locations to begin counts." />
          ) : (
            <DataTable headers={["Name", "Kind", "Pieces"]}>
              {locations.map((l) => (
                <tr key={l.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{l.name}</td>
                  <td className="px-3 py-3">{l.kind}</td>
                  <td className="px-3 py-3">{l._count.items}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
