import Link from "next/link";
import { notFound } from "next/navigation";
import { recordSalePayment, updateCustomer } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { saleTxnLabel } from "@/lib/txn-types";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      sales: {
        include: { payments: true },
        orderBy: { saleDate: "desc" },
      },
      serviceCases: { orderBy: { createdAt: "desc" }, take: 20 },
      vatRefunds: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!customer) notFound();

  const settings = await prisma.shopSettings.findFirst();
  const currency = settings?.currency ?? "AZN";
  const money = (n: number) => formatCurrency(n, currency);

  const openSales = customer.sales.filter(
    (s) => !s.txnType.endsWith("_RETURN") && s.totalAmount - s.paidAmount > 0.01
  );
  const outstanding = openSales.reduce(
    (sum, s) => sum + Math.max(0, s.totalAmount - s.paidAmount),
    0
  );

  const paymentHistory = customer.sales
    .flatMap((s) =>
      s.payments.map((p) => ({
        ...p,
        invoiceNumber: s.invoiceNumber,
        saleId: s.id,
      }))
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={
          [
            customer.vipTier && customer.vipTier !== "STANDARD" ? `VIP ${customer.vipTier}` : null,
            customer.phone,
            customer.email,
          ]
            .filter(Boolean)
            .join(" · ") || "Customer profile"
        }
        actions={
          <Link href="/customers" className="text-sm text-[var(--gold-deep)] hover:underline">
            All customers
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card title="Outstanding">
          <p className="font-[family-name:var(--font-display)] text-3xl text-amber-800">
            {money(outstanding)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {openSales.length} open invoice{openSales.length === 1 ? "" : "s"}
          </p>
        </Card>
        <Card title="Purchases">
          <p className="font-[family-name:var(--font-display)] text-3xl">{customer.sales.length}</p>
        </Card>
        <Card title="Profile">
          <p className="text-sm text-[var(--muted)]">{customer.address || "No address"}</p>
          {customer.gstin ? <p className="mt-1 text-xs">GSTIN: {customer.gstin}</p> : null}
        </Card>
      </div>

      {openSales.length > 0 ? (
        <Card title="Collect payment (udhaar)" className="mb-6">
          <form action={recordSalePayment} className="grid max-w-3xl gap-3 md:grid-cols-4">
            <Select label="Invoice" name="saleId" required defaultValue={openSales[0].id}>
              {openSales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.invoiceNumber} — due {money(s.totalAmount - s.paidAmount)}
                </option>
              ))}
            </Select>
            <Input
              label="Amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={Math.max(0, openSales[0].totalAmount - openSales[0].paidAmount).toFixed(2)}
            />
            <Select label="Method" name="method" defaultValue="CASH" required>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK">Bank</option>
            </Select>
            <Input label="Reference" name="reference" placeholder="Optional" />
            <div className="md:col-span-4">
              <Button type="submit">Record collection</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Purchase history">
          {customer.sales.length === 0 ? (
            <EmptyState title="No purchases yet" />
          ) : (
            <DataTable headers={["Invoice", "Date", "Type", "Total", "Paid", "Due"]}>
              {customer.sales.map((s) => {
                const due = Math.max(0, s.totalAmount - s.paidAmount);
                return (
                  <tr key={s.id}>
                    <td className="px-3 py-3">
                      <Link href={`/sales/${s.id}`} className="font-medium text-[var(--gold-deep)] hover:underline">
                        {s.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{formatDate(s.saleDate)}</td>
                    <td className="px-3 py-3 text-xs">{saleTxnLabel(s.txnType)}</td>
                    <td className="px-3 py-3">{money(s.totalAmount)}</td>
                    <td className="px-3 py-3">{money(s.paidAmount)}</td>
                    <td className="px-3 py-3">
                      {due > 0.01 ? (
                        <span className="font-medium text-amber-800">{money(due)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>

        <Card title="Payment history">
          {paymentHistory.length === 0 ? (
            <EmptyState title="No payments recorded" />
          ) : (
            <DataTable headers={["Date", "Invoice", "Method", "Amount", "Ref"]}>
              {paymentHistory.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-3">{formatDate(p.createdAt)}</td>
                  <td className="px-3 py-3">
                    <Link href={`/sales/${p.saleId}`} className="text-[var(--gold-deep)] hover:underline">
                      {p.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{p.method}</td>
                  <td className="px-3 py-3 font-medium">{money(p.amount)}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{p.reference ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Customer-service history">
          {customer.serviceCases.length === 0 ? (
            <EmptyState title="No service cases" description="Complaints and enquiries are tracked separately from repairs." />
          ) : (
            <div className="space-y-3">
              {customer.serviceCases.map((serviceCase) => (
                <Link key={serviceCase.id} href={`/service/${serviceCase.id}`} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 hover:bg-stone-50">
                  <div><p className="font-medium text-[var(--gold-deep)]">{serviceCase.caseNumber}</p><p className="text-xs text-[var(--muted)]">{serviceCase.subject}</p></div>
                  <Badge>{serviceCase.status.replaceAll("_", " ")}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card title="Tourist VAT-refund history">
          {customer.vatRefunds.length === 0 ? (
            <EmptyState title="No VAT-refund claims" />
          ) : (
            <div className="space-y-3">
              {customer.vatRefunds.map((refund) => (
                <Link key={refund.id} href={`/vat-refunds/${refund.id}`} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 hover:bg-stone-50">
                  <div><p className="font-medium text-[var(--gold-deep)]">{refund.refundNumber}</p><p className="text-xs text-[var(--muted)]">{money(refund.refundableAmount)}</p></div>
                  <Badge>{refund.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Edit customer" className="mt-6">
        <form action={updateCustomer} className="grid max-w-3xl gap-3 md:grid-cols-2">
          <input type="hidden" name="id" value={customer.id} />
          <Input label="Name" name="name" defaultValue={customer.name} required />
          <Input label="Phone" name="phone" defaultValue={customer.phone ?? ""} />
          <Input label="Email" name="email" type="email" defaultValue={customer.email ?? ""} />
          <Input label="GSTIN" name="gstin" defaultValue={customer.gstin ?? ""} />
          <Select label="VIP tier" name="vipTier" defaultValue={customer.vipTier || "STANDARD"}>
            <option value="STANDARD">Standard</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="PLATINUM">Platinum</option>
          </Select>
          <Input label="Tags" name="tags" defaultValue={customer.tags ?? ""} />
          <Input label="Preferred metal" name="preferredMetal" defaultValue={customer.preferredMetal ?? ""} />
          <Input label="Preferred stone" name="preferredStone" defaultValue={customer.preferredStone ?? ""} />
          <Select
            label="Marketing opt-in"
            name="marketingOptIn"
            defaultValue={customer.marketingOptIn ? "1" : "0"}
          >
            <option value="1">Yes</option>
            <option value="0">No</option>
          </Select>
          <div className="md:col-span-2">
            <Textarea label="Address" name="address" rows={2} defaultValue={customer.address ?? ""} />
          </div>
          <div className="md:col-span-2">
            <Textarea label="Notes" name="notes" rows={2} defaultValue={customer.notes ?? ""} />
          </div>
          <Button type="submit">Save profile</Button>
        </form>
      </Card>
    </div>
  );
}
