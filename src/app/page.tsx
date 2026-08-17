import Link from "next/link";
import { getDashboardStats, getShopCurrency } from "@/lib/data";
import { formatCurrency, formatDate, formatWeight } from "@/lib/utils";
import { Badge, Card, DataTable, PageHeader, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, currency] = await Promise.all([getDashboardStats(), getShopCurrency()]);
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Live view of stock, manufacturing, and retail performance · ${currency}.`}
        actions={
          <div className="flex gap-2">
            <Link
              href="/pos"
              className="rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
            >
              Open POS
            </Link>
            <Link
              href="/manufacturing/new"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              New Job
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's Revenue"
          value={money(stats.todayRevenue)}
          hint={`${stats.todaySaleCount} invoice${stats.todaySaleCount === 1 ? "" : "s"}`}
          accent
        />
        <StatCard
          label="Month Revenue"
          value={money(stats.monthRevenue)}
          hint="Completed sales"
        />
        <StatCard
          label="Finished Stock"
          value={String(stats.productCount)}
          hint="Items in stock"
        />
        <StatCard
          label="Open Jobs"
          value={String(stats.openJobs)}
          hint={`${formatWeight(stats.rawWeight)} raw metal`}
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {Object.entries(stats.metalRates).map(([key, rate]) => (
          <div
            key={key}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              {key.replace("-", " · ")}
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--gold-deep)]">
              {money(rate)}
              <span className="text-sm text-[var(--muted)]"> /g</span>
            </p>
          </div>
        ))}
        {Object.keys(stats.metalRates).length === 0 ? (
          <Card title="Metal Rates">
            <p className="text-sm text-[var(--muted)]">
              No rates yet.{" "}
              <Link href="/rates" className="text-[var(--gold-deep)] underline">
                Set rates
              </Link>
            </p>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Recent Sales"
          action={
            <Link href="/sales" className="text-sm text-[var(--gold-deep)] hover:underline">
              View all
            </Link>
          }
        >
          {stats.recentSales.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No sales yet.</p>
          ) : (
            <DataTable headers={["Invoice", "Customer", "Date", "Amount"]}>
              {stats.recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3">
                    <Link href={`/sales/${sale.id}`} className="font-medium text-[var(--gold-deep)]">
                      {sale.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    {sale.customer?.name || sale.customerName || "Walk-in"}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{formatDate(sale.saleDate)}</td>
                  <td className="px-3 py-3 font-medium">{money(sale.totalAmount)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card
          title="Low Stock Alert"
          action={
            <Link href="/inventory" className="text-sm text-[var(--gold-deep)] hover:underline">
              Inventory
            </Link>
          }
        >
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Stock levels look healthy.</p>
          ) : (
            <DataTable headers={["SKU", "Item", "Qty", "Status"]}>
              {stats.lowStock.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-3">{p.name}</td>
                  <td className="px-3 py-3">{p.quantity}</td>
                  <td className="px-3 py-3">
                    <Badge tone={p.quantity === 0 ? "danger" : "warn"}>
                      {p.quantity === 0 ? "Out" : "Low"}
                    </Badge>
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
