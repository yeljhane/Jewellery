import { createSupplier } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const suppliers = await prisma.supplier.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            { phone: { contains: query } },
            { email: { contains: query } },
            { gstin: { contains: query } },
            { address: { contains: query } },
          ],
        }
      : undefined,
    include: { _count: { select: { purchases: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="Suppliers" description="Bullion dealers and material vendors." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Add Supplier" className="lg:col-span-1">
          <ActionForm action={createSupplier} successMessage="The supplier was added successfully." className="space-y-3">
            <Input label="Name" name="name" required />
            <Input label="Phone" name="phone" />
            <Input label="Email" name="email" type="email" />
            <Input label="GSTIN" name="gstin" />
            <Textarea label="Address" name="address" rows={2} />
            <Textarea label="Notes" name="notes" rows={2} />
            <Button type="submit">Save Supplier</Button>
          </ActionForm>
        </Card>
        <Card
          title="Directory"
          className="lg:col-span-2"
          action={
            <form className="flex gap-2">
              <input
                name="q"
                defaultValue={query}
                placeholder="Search name, phone, GSTIN…"
                className="w-52 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
              />
              <Button type="submit" variant="secondary" className="!py-1.5">
                Search
              </Button>
            </form>
          }
        >
          {suppliers.length === 0 ? (
            <EmptyState
              title={query ? "No matches" : "No suppliers"}
              description={query ? `Nothing found for “${query}”.` : undefined}
            />
          ) : (
            <DataTable headers={["Name", "Phone", "GSTIN", "POs"]}>
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3 font-medium">{s.name}</td>
                  <td className="px-3 py-3">{s.phone ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{s.gstin ?? "—"}</td>
                  <td className="px-3 py-3">{s._count.purchases}</td>
                </tr>
              ))}
            </DataTable>
          )}
          {query ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Showing {suppliers.length} result{suppliers.length === 1 ? "" : "s"} for “{query}”.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
