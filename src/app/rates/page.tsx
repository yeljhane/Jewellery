import { createMetalRate } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Select } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RatesPage() {
  const rates = await prisma.metalRate.findMany({
    orderBy: [{ metal: "asc" }, { purity: "asc" }, { effectiveFrom: "desc" }],
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="Metal Rates"
        description="Daily board rates used for billing valuation and job costing."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Post New Rate" className="lg:col-span-1">
          <form action={createMetalRate} className="space-y-3">
            <Select label="Metal" name="metal" defaultValue="GOLD">
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
              <option value="PLATINUM">Platinum</option>
            </Select>
            <Input label="Purity" name="purity" placeholder="22K" required />
            <Input label="Rate per Gram" name="ratePerGram" type="number" step="0.01" required />
            <Button type="submit">Update Rate</Button>
          </form>
        </Card>
        <Card title="Rate History" className="lg:col-span-2">
          {rates.length === 0 ? (
            <EmptyState title="No rates posted" />
          ) : (
            <DataTable headers={["Metal", "Purity", "Rate /g", "Effective"]}>
              {rates.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3 font-medium">{r.metal}</td>
                  <td className="px-3 py-3">{r.purity}</td>
                  <td className="px-3 py-3 text-[var(--gold-deep)] font-semibold">
                    {formatCurrency(r.ratePerGram)}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {formatDate(r.effectiveFrom)}
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
