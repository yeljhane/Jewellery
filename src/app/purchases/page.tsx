import Link from "next/link";
import { receivePurchaseOrder } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { purchaseTxnLabel } from "@/lib/txn-types";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const filter = type && type !== "all" ? type : undefined;

  const orders = await prisma.purchaseOrder.findMany({
    where: filter ? { txnType: filter } : undefined,
    include: { supplier: true, items: true },
    orderBy: { orderDate: "desc" },
  });

  const filters = [
    { value: "all", label: "All" },
    { value: "FINISHED_GOLD_PURCHASE", label: "Gold Finished" },
    { value: "FINISHED_DIAMOND_PURCHASE", label: "Diamond Finished" },
    { value: "FINISHED_GOLD_RETURN", label: "Gold Fin. Return" },
    { value: "FINISHED_DIAMOND_RETURN", label: "Diamond Fin. Return" },
    { value: "GOLD_PURCHASE", label: "Gold Raw" },
    { value: "GOLD_RETURN", label: "Gold Return" },
    { value: "DIAMOND_PURCHASE", label: "Diamond Raw" },
    { value: "DIAMOND_RETURN", label: "Diamond Return" },
  ];

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Raw materials and finished stock. Receiving finished stock adds qty to inventory."
        actions={
          <Link
            href="/purchases/new"
            className="rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
          >
            New Purchase
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = (filter ?? "all") === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === "all" ? "/purchases" : `/purchases?type=${f.value}`}
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
        {orders.length === 0 ? (
          <EmptyState title="No purchase orders" />
        ) : (
          <DataTable
            headers={["PO #", "Category", "Supplier", "Date", "Total", "Status", "Action"]}
          >
            {orders.map((po) => (
              <tr key={po.id} className="hover:bg-stone-50/80">
                <td className="px-3 py-3 font-medium">{po.poNumber}</td>
                <td className="px-3 py-3">
                  <Badge
                    tone={
                      (po.txnType ?? "").includes("DIAMOND")
                        ? "info"
                        : (po.txnType ?? "").includes("RETURN")
                          ? "warn"
                          : "gold"
                    }
                  >
                    {purchaseTxnLabel(po.txnType || "GOLD_PURCHASE")}
                  </Badge>
                </td>
                <td className="px-3 py-3">{po.supplier.name}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{formatDate(po.orderDate)}</td>
                <td className="px-3 py-3 font-medium">{formatCurrency(po.totalAmount)}</td>
                <td className="px-3 py-3">
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
                </td>
                <td className="px-3 py-3">
                  {po.status !== "RECEIVED" && po.status !== "CANCELLED" ? (
                    <form action={receivePurchaseOrder}>
                      <input type="hidden" name="id" value={po.id} />
                      <Button type="submit" variant="secondary" className="!px-2 !py-1 text-xs">
                        Mark Received
                      </Button>
                    </form>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">
                      {po.receivedDate ? formatDate(po.receivedDate) : "—"}
                    </span>
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
