import { createAppraisal, createTradeIn } from "@/lib/jewelry-pos-actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppraisalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const showTradeIns = tab === "tradeins";

  const [settings, customers, products, sales, appraisals, tradeIns] = await Promise.all([
    prisma.shopSettings.findFirst(),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, take: 100 }),
    prisma.sale.findMany({
      where: { status: "COMPLETED" },
      orderBy: { saleDate: "desc" },
      take: 50,
    }),
    prisma.appraisal.findMany({
      include: { customer: true, product: true },
      orderBy: { appraisedAt: "desc" },
      take: 100,
    }),
    prisma.tradeIn.findMany({
      include: { customer: true, sale: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const currency = settings?.currency ?? "AZN";

  return (
    <div>
      <PageHeader
        title="Appraisals & Trade-Ins"
        description="Insurance valuations and trade-in credits against sales."
        actions={
          <div className="flex gap-2 text-sm">
            <a
              href="/appraisals"
              className={!showTradeIns ? "text-[var(--gold-deep)] underline" : "text-[var(--muted)]"}
            >
              Appraisals
            </a>
            <a
              href="/appraisals?tab=tradeins"
              className={showTradeIns ? "text-[var(--gold-deep)] underline" : "text-[var(--muted)]"}
            >
              Trade-ins
            </a>
          </div>
        }
      />

      {!showTradeIns ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="New Appraisal" className="lg:col-span-1">
            <form action={createAppraisal} className="space-y-3">
              <Select label="Customer" name="customerId" defaultValue="">
                <option value="">Walk-in</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Input label="Customer name" name="customerName" />
              <Select label="Linked product" name="productId" defaultValue="">
                <option value="">None</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </Select>
              <Textarea label="Description" name="description" rows={2} required />
              <Input label="Metal" name="metal" placeholder="GOLD" />
              <Input label="Purity" name="purity" placeholder="22K" />
              <Input label="Net weight (g)" name="netWeight" type="number" step="0.001" />
              <Input label="Appraised value" name="appraisedValue" type="number" step="0.01" required />
              <Select label="Purpose" name="purpose" defaultValue="INSURANCE">
                <option value="INSURANCE">Insurance</option>
                <option value="SALE">Sale</option>
                <option value="TRADE_IN">Trade-in</option>
                <option value="OTHER">Other</option>
              </Select>
              <Textarea label="Notes" name="notes" rows={2} />
              <Button type="submit">Save Appraisal</Button>
            </form>
          </Card>
          <Card title="Recent Appraisals" className="lg:col-span-2">
            {appraisals.length === 0 ? (
              <EmptyState title="No appraisals" description="Record a valuation for a client piece." />
            ) : (
              <DataTable headers={["No.", "Customer", "Purpose", "Value", "Date"]}>
                {appraisals.map((a) => (
                  <tr key={a.id} className="hover:bg-stone-50/80">
                    <td className="px-3 py-3 font-medium">{a.appraisalNumber}</td>
                    <td className="px-3 py-3">{a.customer?.name || a.customerName || "—"}</td>
                    <td className="px-3 py-3">{a.purpose.replaceAll("_", " ")}</td>
                    <td className="px-3 py-3">{formatCurrency(a.appraisedValue, currency)}</td>
                    <td className="px-3 py-3">{a.appraisedAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Record Trade-In" className="lg:col-span-1">
            <form action={createTradeIn} className="space-y-3">
              <Select label="Customer" name="customerId" defaultValue="">
                <option value="">Walk-in</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Input label="Customer name" name="customerName" />
              <Textarea label="Description" name="description" rows={2} required />
              <Input label="Metal" name="metal" />
              <Input label="Purity" name="purity" />
              <Input label="Net weight (g)" name="netWeight" type="number" step="0.001" />
              <Input label="Credit amount" name="creditAmount" type="number" step="0.01" required />
              <Select label="Apply to sale (optional)" name="saleId" defaultValue="">
                <option value="">Hold credit only</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.invoiceNumber} — {formatCurrency(s.totalAmount, currency)}
                  </option>
                ))}
              </Select>
              <Textarea label="Notes" name="notes" rows={2} />
              <Button type="submit">Save Trade-In</Button>
            </form>
          </Card>
          <Card title="Trade-In Register" className="lg:col-span-2">
            {tradeIns.length === 0 ? (
              <EmptyState title="No trade-ins" description="Accept a piece as credit toward a sale." />
            ) : (
              <DataTable headers={["Customer", "Description", "Credit", "Status", "Sale"]}>
                {tradeIns.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/80">
                    <td className="px-3 py-3">{t.customer?.name || t.customerName || "—"}</td>
                    <td className="px-3 py-3">{t.description}</td>
                    <td className="px-3 py-3">{formatCurrency(t.creditAmount, currency)}</td>
                    <td className="px-3 py-3">{t.status}</td>
                    <td className="px-3 py-3">{t.sale?.invoiceNumber || "—"}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
