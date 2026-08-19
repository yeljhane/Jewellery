import Link from "next/link";
import { createTouristVatRefund } from "@/lib/customer-service-actions";
import { normalizeLanguage } from "@/lib/localization";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Select, StatCard, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

const COPY = {
  AZ: ["Turist ƏDV qaytarılması", "Uyğunluq yoxlaması, təsdiqləmə və ödəniş üçün izlənilən iş axını."],
  RU: ["Возврат НДС туристам", "Контролируемый процесс проверки права, подтверждения и выплаты возврата."],
  AR: ["استرداد ضريبة القيمة المضافة للسياح", "مسار عمل موثق للتحقق من الأهلية والتصديق والدفع."],
  EN: ["Tourist VAT Refunds", "A tracked workflow for eligibility, validation, and refund payment."],
} as const;

function tone(status: string) {
  if (status === "PAID") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "VALIDATED") return "info" as const;
  return "warn" as const;
}

export default async function TouristVatRefundsPage() {
  const [settings, refunds, sales, pendingCount, paidAgg] = await Promise.all([
    prisma.shopSettings.findFirst(),
    prisma.touristVatRefund.findMany({ include: { sale: true, customer: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.sale.findMany({
      where: { status: "COMPLETED", taxAmount: { gt: 0 }, txnType: { notIn: ["GOLD_RETURN", "DIAMOND_RETURN"] } },
      include: { customer: true }, orderBy: { saleDate: "desc" }, take: 200,
    }),
    prisma.touristVatRefund.count({ where: { status: { in: ["DRAFT", "ELIGIBLE", "VALIDATED"] } } }),
    prisma.touristVatRefund.aggregate({ where: { status: "PAID" }, _sum: { refundableAmount: true } }),
  ]);
  const language = normalizeLanguage(settings?.interfaceLanguage);
  const [title, description] = COPY[language];
  const currency = settings?.currency || "AZN";
  const usedSaleIds = new Set(refunds.filter((refund) => refund.status !== "REJECTED").map((refund) => refund.saleId));
  const eligibleSales = sales.filter((sale) => {
    const expectedVat = Math.round(Math.max(0, sale.subtotal - sale.discount) * ((settings?.taxPct ?? 18) / 100) * 100) / 100;
    return !usedSaleIds.has(sale.id) && sale.totalAmount > (settings?.vatRefundMinSale ?? 300) && Math.abs(sale.taxAmount - expectedVat) <= 0.02;
  });

  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Claims in progress" value={String(pendingCount)} />
        <StatCard label="Paid refunds" value={formatCurrency(paidAgg._sum.refundableAmount || 0, currency)} />
        <StatCard label="Purchase threshold" value={`Above ${formatCurrency(settings?.vatRefundMinSale ?? 300, currency)}`} hint={settings?.taxFreeMerchantRegistered ? "Tax-free merchant registered" : "Merchant registration required"} />
      </div>

      <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Compliance checklist: completed tax-bearing invoice, tourist identity and passport, nationality, departure details, validation reference, and a recorded refund method. Legal thresholds remain configurable in Settings.
      </div>

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Card title="Create refund claim">
          {settings?.touristVatRefundEnabled === false || !settings?.taxFreeMerchantRegistered ? (
            <EmptyState title="Workflow unavailable" description="Enable the workflow and confirm tax-free merchant registration in Settings before creating claims." />
          ) : (
            <ActionForm action={createTouristVatRefund} successMessage="The tourist VAT-refund claim was added successfully." className="space-y-3">
              <Select label="Sales invoice" name="saleId" required defaultValue="">
                <option value="" disabled>Select an eligible invoice</option>
                {eligibleSales.map((sale) => (
                  <option key={sale.id} value={sale.id}>{sale.invoiceNumber} · {sale.customer?.name || sale.customerName || "Walk-in"} · {formatCurrency(sale.totalAmount, currency)} · VAT {formatCurrency(sale.taxAmount, currency)}</option>
                ))}
              </Select>
              <Input label="Tourist full name" name="touristName" required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Passport number" name="passportNumber" required autoComplete="off" />
                <Input label="Nationality" name="nationality" required />
              </div>
              <Input label="Electronic tax-invoice number" name="eTaxInvoiceNumber" required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Air departure date" name="departureDate" type="date" required />
                <Input label="Departure airport" name="departurePoint" placeholder="GYD" required />
              </div>
              <label className="flex gap-2 text-xs"><input type="checkbox" name="foreignVisitorConfirmed" value="1" required /> Foreign visitor is eligible and is not an Azerbaijani citizen/resident/worker.</label>
              <label className="flex gap-2 text-xs"><input type="checkbox" name="nonCommercialUseConfirmed" value="1" required /> Goods are for personal, non-commercial use.</label>
              <label className="flex gap-2 text-xs"><input type="checkbox" name="eligibleGoodsConfirmed" value="1" required /> Goods are eligible and will leave Azerbaijan in accompanied baggage by air within 90 days.</label>
              <p className="text-xs text-[var(--muted)]">The configured {settings?.vatRefundFeePct ?? 20}% operator fee is deducted automatically from recorded VAT.</p>
              <Textarea label="Eligibility notes" name="eligibilityNotes" rows={3} />
              <Button type="submit" disabled={eligibleSales.length === 0}>Create eligible claim</Button>
              {eligibleSales.length === 0 ? <p className="text-xs text-[var(--muted)]">No unused eligible sales invoices are available.</p> : null}
            </ActionForm>
          )}
        </Card>

        <Card title="Refund register">
          {refunds.length === 0 ? (
            <EmptyState title="No VAT-refund claims" description="Eligible tourist transactions will appear in this register." />
          ) : (
            <DataTable headers={["Claim", "Tourist", "Invoice", "Refund", "Status"]}>
              {refunds.map((refund) => (
                <tr key={refund.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3"><Link href={`/vat-refunds/${refund.id}`} className="font-medium text-[var(--gold-deep)] hover:underline">{refund.refundNumber}</Link><p className="text-xs text-[var(--muted)]">{refund.createdAt.toLocaleDateString()}</p></td>
                  <td className="px-3 py-3">{refund.touristName}<p className="text-xs text-[var(--muted)]">{refund.nationality}</p></td>
                  <td className="px-3 py-3"><Link href={`/sales/${refund.saleId}`} className="hover:underline">{refund.sale.invoiceNumber}</Link><p className="text-xs text-[var(--muted)]">VAT {formatCurrency(refund.vatAmount, currency)}</p></td>
                  <td className="px-3 py-3 font-medium">{formatCurrency(refund.refundableAmount, currency)}</td>
                  <td className="px-3 py-3"><Badge tone={tone(refund.status)}>{refund.status}</Badge></td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
