import Link from "next/link";
import { deleteSale } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { saleTxnLabel } from "@/lib/txn-types";
import { Badge, Card, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { DeleteButton } from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const filter = type && type !== "all" ? type : undefined;

  const [sales, settings] = await Promise.all([
    prisma.sale.findMany({
      where: filter ? { txnType: filter } : undefined,
      include: { customer: true, employee: true, items: true, payments: true },
      orderBy: { saleDate: "desc" },
    }),
    prisma.shopSettings.findFirst(),
  ]);
  const currency = settings?.currency ?? "AZN";
  const money = (n: number) => formatCurrency(n, currency);

  const filters = [
    { value: "all", label: "All" },
    { value: "RETAIL_SALE", label: "Retail Sales" },
    { value: "RETAIL_RETURN", label: "Retail Return" },
    { value: "GOLD_SALE", label: "Gold Sales" },
    { value: "GOLD_RETURN", label: "Gold Sales Return" },
    { value: "DIAMOND_SALE", label: "Diamond Sales" },
    { value: "DIAMOND_RETURN", label: "Diamond Sales Return" },
  ];

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Invoice history, returns, and printouts. Use POS for counter billing."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/pos"
              className="rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
            >
              Open POS
            </Link>
            <Link
              href="/sales/new"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              New sale / return
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = (filter ?? "all") === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === "all" ? "/sales" : `/sales?type=${f.value}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                active
                  ? "bg-[var(--gold-deep)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-stone-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <Card>
        {sales.length === 0 ? (
          <EmptyState
            title="No sales yet"
            description="Open POS to create your first invoice."
          />
        ) : (
          <DataTable
            headers={[
              "Invoice",
              "Category",
              "Customer",
              "Payment",
              "Date",
              "Total",
              "Status",
              "Actions",
            ]}
          >
            {sales.map((s) => (
              <tr key={s.id} className="hover:bg-stone-50/80">
                <td className="px-3 py-3">
                  <Link href={`/sales/${s.id}`} className="font-medium text-[var(--gold-deep)]">
                    {s.invoiceNumber}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <Badge
                    tone={
                      (s.txnType ?? "").includes("DIAMOND")
                        ? "info"
                        : (s.txnType ?? "").includes("RETAIL")
                          ? "success"
                          : (s.txnType ?? "").includes("RETURN")
                            ? "warn"
                            : "gold"
                    }
                  >
                    {saleTxnLabel(s.txnType || "GOLD_SALE")}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  {s.customer?.name || s.customerName || "Walk-in"}
                </td>
                <td className="px-3 py-3">
                  <Badge tone="neutral">
                    {s.payments.length > 1
                      ? `MIXED (${s.payments.map((p) => p.method).join("+")})`
                      : s.payments[0]?.method || s.paymentMethod}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">{formatDate(s.saleDate)}</td>
                <td className="px-3 py-3 font-medium">{money(s.totalAmount)}</td>
                <td className="px-3 py-3">
                  <Badge
                    tone={
                      s.status === "COMPLETED"
                        ? "success"
                        : s.status === "RETURNED"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {s.status}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/sales/${s.id}/edit`}
                      className="text-xs font-medium text-[var(--gold-deep)] hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteButton
                      action={deleteSale}
                      id={s.id}
                      label="Delete"
                      message={`Delete sale ${s.invoiceNumber}? Stock will be restored.`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
