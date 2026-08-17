import { createKarigar } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KarigarsPage() {
  const karigars = await prisma.karigar.findMany({
    include: { _count: { select: { jobOrders: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Karigars"
        description="Artisans and workshop partners for casting, setting, and polishing."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Add Karigar" className="lg:col-span-1">
          <form action={createKarigar} className="space-y-3">
            <Input label="Name" name="name" required />
            <Input label="Phone" name="phone" />
            <Input label="Specialty" name="specialty" placeholder="Casting & Setting" />
            <Input label="Daily Wage" name="dailyWage" type="number" step="0.01" />
            <Textarea label="Notes" name="notes" rows={2} />
            <Button type="submit">Save Karigar</Button>
          </form>
        </Card>
        <Card title="Workshop Roster" className="lg:col-span-2">
          {karigars.length === 0 ? (
            <EmptyState title="No karigars" />
          ) : (
            <DataTable headers={["Name", "Specialty", "Wage", "Jobs"]}>
              {karigars.map((k) => (
                <tr key={k.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3 font-medium">{k.name}</td>
                  <td className="px-3 py-3">
                    {k.specialty ? <Badge tone="info">{k.specialty}</Badge> : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {k.dailyWage ? formatCurrency(k.dailyWage) : "—"}
                  </td>
                  <td className="px-3 py-3">{k._count.jobOrders}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
