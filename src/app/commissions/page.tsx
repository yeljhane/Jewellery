import { markCommissionPaid } from "@/lib/jewelry-pos-actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Button, Card, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function CommissionsPage() {
  const [settings, entries] = await Promise.all([
    prisma.shopSettings.findFirst(),
    prisma.commissionEntry.findMany({
      include: {
        employee: true,
        sale: { select: { invoiceNumber: true, saleDate: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const currency = settings?.currency ?? "AZN";
  const accrued = entries
    .filter((e) => e.status === "ACCRUED")
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader
        title="Staff Commissions"
        description={`Default rate ${settings?.commissionPct ?? 1}% of sale. Accrued on completed sales with a salesperson.`}
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card title="Accrued outstanding">
          <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--gold-deep)]">
            {formatCurrency(accrued, currency)}
          </p>
        </Card>
        <Card title="Entries">
          <p className="text-2xl">{entries.length}</p>
        </Card>
      </div>
      <Card title="Commission ledger">
        {entries.length === 0 ? (
          <EmptyState
            title="No commissions yet"
            description="Complete a sale with a salesperson assigned to accrue commission."
          />
        ) : (
          <DataTable headers={["Staff", "Invoice", "Sale", "Rate", "Commission", "Status", ""]}>
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-stone-50/80">
                <td className="px-3 py-3">{e.employee.name}</td>
                <td className="px-3 py-3">{e.sale.invoiceNumber}</td>
                <td className="px-3 py-3">{formatCurrency(e.saleAmount, currency)}</td>
                <td className="px-3 py-3">{e.ratePct}%</td>
                <td className="px-3 py-3">{formatCurrency(e.amount, currency)}</td>
                <td className="px-3 py-3">{e.status}</td>
                <td className="px-3 py-3">
                  {e.status === "ACCRUED" ? (
                    <ActionForm action={markCommissionPaid} successTitle="Commission updated" successMessage="The commission was marked as paid.">
                      <input type="hidden" name="id" value={e.id} />
                      <Button type="submit" variant="secondary" className="!py-1 !text-xs">
                        Mark paid
                      </Button>
                    </ActionForm>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
