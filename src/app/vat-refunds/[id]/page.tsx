import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { updateTouristVatRefundStatus } from "@/lib/customer-service-actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge, Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "PAID") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "VALIDATED") return "info" as const;
  return "warn" as const;
}

export default async function TouristVatRefundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [refund, settings, session] = await Promise.all([
    prisma.touristVatRefund.findUnique({
      where: { id },
      include: { sale: true, customer: true, createdBy: true, events: { include: { actor: true }, orderBy: { createdAt: "desc" } } },
    }),
    prisma.shopSettings.findFirst(),
    auth(),
  ]);
  if (!refund) notFound();
  const currency = settings?.currency || "AZN";
  const canSeePassport = ["OWNER", "MANAGER", "ACCOUNTANT"].includes(session?.user?.role || "");
  const passport = canSeePassport ? refund.passportNumber : `••••${refund.passportNumber.slice(-4)}`;
  const nextStatuses =
    refund.status === "DRAFT" ? ["ELIGIBLE", "REJECTED"] :
      refund.status === "ELIGIBLE" ? ["VALIDATED", "REJECTED"] :
        refund.status === "VALIDATED" ? ["PAID", "REJECTED"] : [];

  return (
    <div>
      <PageHeader
        title={refund.refundNumber}
        description={`Tourist VAT-refund claim · ${refund.status}`}
        actions={<Link href="/vat-refunds" className="text-sm text-[var(--gold-deep)] hover:underline">Back to refund register</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Claim and tourist details">
            <div className="mb-5"><Badge tone={statusTone(refund.status)}>{refund.status}</Badge></div>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-[var(--muted)]">Tourist</dt><dd>{refund.touristName}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Nationality</dt><dd>{refund.nationality}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Passport</dt><dd className="font-mono">{passport}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Departure</dt><dd>{refund.departureDate?.toLocaleDateString() || "—"} · {refund.departurePoint || "—"}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Invoice</dt><dd><Link href={`/sales/${refund.saleId}`} className="text-[var(--gold-deep)] hover:underline">{refund.sale.invoiceNumber}</Link></dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Electronic tax invoice</dt><dd>{refund.eTaxInvoiceNumber}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Created by</dt><dd>{refund.createdBy?.name || "System"}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Validation / payment</dt><dd>{refund.validationRef || "—"} · {refund.refundMethod || "—"}</dd></div>
            </dl>
          </Card>

          <Card title="Compliance history">
            <div className="space-y-3">
              {refund.events.map((event) => (
                <article key={event.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between gap-3"><Badge tone={statusTone(event.action)}>{event.action}</Badge><span className="text-xs text-[var(--muted)]">{event.createdAt.toLocaleString()} · {event.actor?.name || "System"}</span></div>
                  {event.note ? <p className="mt-2 text-sm">{event.note}</p> : null}
                </article>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Refund calculation">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Invoice total</dt><dd>{formatCurrency(refund.invoiceTotal, currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">VAT recorded</dt><dd>{formatCurrency(refund.vatAmount, currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Administration fee</dt><dd>- {formatCurrency(refund.administrationFee, currency)}</dd></div>
              <div className="flex justify-between border-t border-[var(--border)] pt-3 text-base font-semibold"><dt>Refundable</dt><dd>{formatCurrency(refund.refundableAmount, currency)}</dd></div>
            </dl>
          </Card>

          {nextStatuses.length > 0 ? (
            <Card title="Advance workflow">
              <form action={updateTouristVatRefundStatus} className="space-y-3">
                <input type="hidden" name="id" value={refund.id} />
                <Select label="Next status" name="status" required defaultValue={nextStatuses[0]}>
                  {nextStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </Select>
                {refund.status === "ELIGIBLE" ? <Input label="Validation reference" name="validationRef" placeholder="Provider / customs reference" /> : null}
                {refund.status === "VALIDATED" ? (
                  <Select label="Refund method" name="refundMethod" defaultValue="CARD">
                    <option value="CARD">Bank card</option><option value="CASH">Cash</option>
                  </Select>
                ) : null}
                <Textarea label="Compliance note" name="note" rows={3} />
                <Button type="submit">Update claim</Button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
