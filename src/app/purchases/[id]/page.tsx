import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePurchaseOrder, receivePurchaseOrder } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatWeight } from "@/lib/utils";
import { purchaseTxnLabel } from "@/lib/txn-types";
import { Badge, Button, Card, DataTable, PageHeader } from "@/components/ui";
import { DeleteButton } from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { product: true } } },
  });
  if (!po) notFound();

  return (
    <div>
      <PageHeader
        title={po.poNumber}
        description={`${purchaseTxnLabel(po.txnType || "GOLD_PURCHASE")} · ${formatDate(po.orderDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/purchases/${po.id}/edit`}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
            >
              Edit
            </Link>
            <DeleteButton
              action={deletePurchaseOrder}
              id={po.id}
              message={`Delete purchase ${po.poNumber}? Stock and accounting for received orders will be reversed.`}
            />
            <Link href="/purchases" className="text-sm text-[var(--gold-deep)] hover:underline">
              All purchases
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Supplier</p>
          <p className="mt-2 font-medium">{po.supplier.name}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{po.supplier.phone}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Status</p>
          <div className="mt-2">
            <Badge
              tone={
                po.status === "RECEIVED"
                  ? "success"
                  : po.status === "CANCELLED"
                    ? "danger"
                    : "warn"
              }
            >
              {po.status}
            </Badge>
          </div>
          {po.receivedDate ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Received {formatDate(po.receivedDate)}
            </p>
          ) : null}
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Total</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--gold-deep)]">
            {formatCurrency(po.totalAmount)}
          </p>
          {po.status !== "RECEIVED" && po.status !== "CANCELLED" ? (
            <form action={receivePurchaseOrder} className="mt-3">
              <input type="hidden" name="id" value={po.id} />
              <Button type="submit" variant="secondary" className="!px-3 !py-1.5 text-xs">
                Mark Received
              </Button>
            </form>
          ) : null}
        </Card>
      </div>

      <Card title="Line Items">
        <DataTable headers={["Description", "Metal", "Weight", "Qty", "Rate", "Amount"]}>
          {po.items.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-3 font-medium">
                {item.description}
                {item.product ? (
                  <p className="text-xs text-[var(--muted)]">
                    Stock:{" "}
                    <Link
                      href={`/inventory/${item.product.id}/edit`}
                      className="text-[var(--gold-deep)] hover:underline"
                    >
                      {item.product.sku}
                    </Link>{" "}
                    · now qty {item.product.quantity}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-3">
                {item.metal} {item.purity}
              </td>
              <td className="px-3 py-3">{formatWeight(item.weightGrams)}</td>
              <td className="px-3 py-3">{item.quantity}</td>
              <td className="px-3 py-3">{formatCurrency(item.rate)}</td>
              <td className="px-3 py-3 font-medium">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </DataTable>
        <div className="mt-6 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Subtotal</span>
            <span>{formatCurrency(po.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Tax</span>
            <span>{formatCurrency(po.taxAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(po.totalAmount)}</span>
          </div>
          {po.notes ? (
            <p className="pt-2 text-xs text-[var(--muted)]">Notes: {po.notes}</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
