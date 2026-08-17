import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSale } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatWeight } from "@/lib/utils";
import { saleTxnLabel } from "@/lib/txn-types";
import { Badge, Card, DataTable, PageHeader } from "@/components/ui";
import { DeleteButton } from "@/components/ConfirmForm";
import { PrintButton } from "@/components/PrintButton";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { customer: true, employee: true, items: true, payments: true },
  });
  if (!sale) notFound();

  const settings = await prisma.shopSettings.findFirst();
  const currency = settings?.currency ?? "INR";
  const money = (n: number) => formatCurrency(n, currency);

  const customerDisplay =
    sale.customer?.name || sale.customerName?.trim() || "Walk-in";
  const paymentLabel =
    sale.payments.length > 0
      ? sale.payments
          .map((p) => {
            const cur = p.currency || currency;
            if (cur !== currency && p.foreignAmount != null) {
              return `${p.method} ${formatCurrency(p.foreignAmount, cur)} (=${money(p.amount)})`;
            }
            return `${p.method} ${money(p.amount)}`;
          })
          .join(" · ")
      : sale.paymentMethod;

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={sale.invoiceNumber}
          description={`${formatDate(sale.saleDate)} · ${paymentLabel}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PrintButton label="Print Invoice" />
              <DownloadPdfButton filename={`${sale.invoiceNumber}.pdf`} />
              <Link
                href={`/sales/${sale.id}/edit`}
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                Edit
              </Link>
              <DeleteButton
                action={deleteSale}
                id={sale.id}
                message={`Delete sale ${sale.invoiceNumber}? Stock will be restored and the accounting entry removed.`}
              />
              <Link href="/sales" className="text-sm text-[var(--gold-deep)] hover:underline">
                All sales
              </Link>
              <Link href="/pos" className="text-sm text-[var(--muted)] hover:underline">
                POS
              </Link>
            </div>
          }
        />
      </div>

      <div className="invoice-sheet space-y-6">
        <header className="print-header border-b border-[var(--border)] pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-start gap-4">
              {settings?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logoUrl}
                  alt={settings.shopName ?? "Company logo"}
                  className="company-logo h-16 w-auto max-w-[160px] object-contain"
                />
              ) : null}
              <div>
                <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--gold-deep)]">
                  {settings?.shopName ?? "Avenue JOAILLERIE"}
                </p>
                {settings?.address ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">{settings.address}</p>
                ) : null}
                <p className="text-xs text-[var(--muted)]">
                  {[settings?.phone, settings?.email].filter(Boolean).join(" · ")}
                </p>
                {settings?.gstin ? (
                  <p className="text-xs text-[var(--muted)]">Tax No: {settings.gstin}</p>
                ) : null}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <h1 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                Tax Invoice
              </h1>
              <p className="mt-1 text-sm font-medium">{sale.invoiceNumber}</p>
              <p className="text-xs text-[var(--muted)]">{formatDate(sale.saleDate)}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {saleTxnLabel(sale.txnType || "GOLD_SALE")}
              </p>
              <div className="mt-2 no-print">
                <Badge tone={sale.status === "COMPLETED" ? "success" : "warn"}>
                  {sale.status}
                </Badge>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Bill to</p>
            <p className="mt-1 font-medium text-[var(--ink)]">{customerDisplay}</p>
            {sale.customer?.phone ? (
              <p className="text-xs text-[var(--muted)]">{sale.customer.phone}</p>
            ) : null}
            {sale.customer?.address ? (
              <p className="text-xs text-[var(--muted)]">{sale.customer.address}</p>
            ) : null}
          </div>
          <div className="md:text-right">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Amount</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--gold-deep)]">
              {money(sale.totalAmount)}
            </p>
            <p className="text-xs text-[var(--muted)]">{paymentLabel}</p>
          </div>
        </div>

        <Card title="Line Items" className="print-card">
          <DataTable
            headers={["Description", "Metal", "Weight", "Rate", "Making", "Stones", "Amount"]}
          >
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-3 font-medium">{item.description}</td>
                <td className="px-3 py-3">
                  {item.metal} {item.purity}
                </td>
                <td className="px-3 py-3">{formatWeight(item.netWeight)}</td>
                <td className="px-3 py-3">{money(item.metalRate)}</td>
                <td className="px-3 py-3">{money(item.makingCharge)}</td>
                <td className="px-3 py-3">{money(item.stoneCharge)}</td>
                <td className="px-3 py-3 font-medium">{money(item.amount)}</td>
              </tr>
            ))}
          </DataTable>
          <div className="mt-6 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Subtotal</span>
              <span>{money(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Discount</span>
              <span>− {money(sale.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Tax</span>
              <span>{money(sale.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Invoice total</span>
              <span>{money(sale.totalAmount)}</span>
            </div>
          </div>
        </Card>

        <Card title="Payments" className="print-card">
          {sale.payments.length > 0 ? (
            <DataTable headers={["Method", "Paid", "Rate", "In shop currency", "Reference"]}>
              {sale.payments.map((p) => {
                const cur = (p.currency || currency).toUpperCase();
                const fx = cur !== currency.toUpperCase();
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-3 font-medium">{p.method}</td>
                    <td className="px-3 py-3">
                      {formatCurrency(p.foreignAmount ?? p.amount, cur)}
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {fx ? `1 ${cur} = ${p.exchangeRate} ${currency}` : "—"}
                    </td>
                    <td className="px-3 py-3">{money(p.amount)}</td>
                    <td className="px-3 py-3 text-[var(--muted)]">{p.reference ?? "—"}</td>
                  </tr>
                );
              })}
            </DataTable>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              {sale.paymentMethod} · {money(sale.paidAmount)}
            </p>
          )}
          <div className="mt-4 space-y-1 border-t border-[var(--border)] pt-4 text-sm">
            <div className="flex justify-between font-semibold">
              <span>Total paid</span>
              <span>{money(sale.paidAmount)}</span>
            </div>
            {sale.totalAmount - sale.paidAmount > 0.01 ? (
              <div className="flex justify-between text-amber-800">
                <span>Balance due</span>
                <span>{money(sale.totalAmount - sale.paidAmount)}</span>
              </div>
            ) : null}
            {sale.employee ? (
              <p className="pt-2 text-xs text-[var(--muted)]">Sold by {sale.employee.name}</p>
            ) : null}
            {sale.notes ? (
              <p className="pt-2 text-xs text-[var(--muted)]">Notes: {sale.notes}</p>
            ) : null}
          </div>
        </Card>

        <p className="hidden text-center text-xs text-[var(--muted)] print:block">
          Thank you for your purchase.
        </p>
      </div>
    </div>
  );
}
