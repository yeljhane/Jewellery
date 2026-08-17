import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getSalesAnalytics } from "@/lib/sales-analytics";
import { getShopCurrency } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DateRangeToolbar,
  formatPeriodLabel,
  parseReportDates,
} from "@/components/ReportControls";
import { Badge, Card, DataTable, EmptyState, PageHeader, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { from, to, fromValue, toValue } = parseReportDates(params);
  const [analytics, currency] = await Promise.all([
    getSalesAnalytics(from, to),
    getShopCurrency(),
  ]);
  const money = (n: number) => formatCurrency(n, currency);
  const period = formatPeriodLabel(from, to);
  const topBand = [...analytics.demand.priceBands].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div>
      <PageHeader
        title="AI Sales Analytics"
        description={`Forecasting, demand, VIP scoring, pricing guardrails, anomalies, and stock actions · ${period}`}
        actions={
          <Link
            href="/sales"
            className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
          >
            Sales
          </Link>
        }
      />

      <DateRangeToolbar fromValue={fromValue} toValue={toValue} />

      <div className="mb-6 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] via-white to-amber-50/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--gold-deep)]" />
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
            AI insights
          </h2>
        </div>
        <ul className="space-y-2">
          {analytics.insights.map((line, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--ink)]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gross revenue"
          value={money(analytics.summary.grossRevenue)}
          hint={`${analytics.summary.invoiceCount} invoices`}
          accent
        />
        <StatCard
          label="Next-month forecast"
          value={money(analytics.forecast.predictedRevenue)}
          hint={`${analytics.forecast.trendPct >= 0 ? "+" : ""}${analytics.forecast.trendPct.toFixed(0)}% trend · ${analytics.forecast.confidence} confidence`}
        />
        <StatCard
          label="Discount cap"
          value={`${analytics.pricingGuidance.recommendedMaxDiscountPct}%`}
          hint="Suggested max before manager approval"
        />
        <StatCard
          label="Anomalies"
          value={String(analytics.anomalies.length)}
          hint="Unusual discounts / returns"
        />
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card
          title="Sales forecast (12 months)"
          action={<Badge tone="info">{analytics.forecast.nextMonth}</Badge>}
        >
          {analytics.forecast.monthlySeries.every((m) => m.revenue === 0) ? (
            <EmptyState title="Need history" description="Post a few months of sales to forecast." />
          ) : (
            <DataTable headers={["Month", "Revenue"]}>
              {analytics.forecast.monthlySeries.map((m) => (
                <tr key={m.month} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{m.month}</td>
                  <td className="px-3 py-3">{money(m.revenue)}</td>
                </tr>
              ))}
              <tr className="border-t border-[var(--border)] bg-amber-50/50">
                <td className="px-3 py-3 font-medium">Forecast {analytics.forecast.nextMonth}</td>
                <td className="px-3 py-3 font-medium text-[var(--gold-deep)]">
                  {money(analytics.forecast.predictedRevenue)}
                </td>
              </tr>
            </DataTable>
          )}
        </Card>

        <Card
          title="Demand mix"
          action={topBand ? <Badge tone="gold">Band: {topBand.key}</Badge> : null}
        >
          <div className="mb-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Metal</p>
            {analytics.demand.metals.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No metal demand in period.</p>
            ) : (
              <DataTable headers={["Metal", "Qty", "Revenue"]}>
                {analytics.demand.metals.map((m) => (
                  <tr key={m.key} className="border-t border-[var(--border)]">
                    <td className="px-3 py-3 font-medium">{m.key}</td>
                    <td className="px-3 py-3">{m.qty}</td>
                    <td className="px-3 py-3">{money(m.revenue)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </div>
          <div className="mb-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Purity</p>
            <DataTable headers={["Purity", "Qty", "Revenue"]}>
              {analytics.demand.purities.map((p) => (
                <tr key={p.key} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{p.key}</td>
                  <td className="px-3 py-3">{p.qty}</td>
                  <td className="px-3 py-3">{money(p.revenue)}</td>
                </tr>
              ))}
            </DataTable>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Price level</p>
            <DataTable headers={["Band", "Qty", "Revenue"]}>
              {analytics.demand.priceBands.map((b) => (
                <tr key={b.key} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{b.key}</td>
                  <td className="px-3 py-3">{b.qty}</td>
                  <td className="px-3 py-3">{money(b.revenue)}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card
          title="Which collection sells best?"
          action={
            analytics.collections[0] ? (
              <Badge tone="gold">Top: {analytics.collections[0].name}</Badge>
            ) : null
          }
        >
          {analytics.collections.length === 0 ? (
            <EmptyState
              title="No collection sales"
              description="Complete sales in this period to rank collections."
            />
          ) : (
            <DataTable headers={["Collection", "Qty", "Revenue", "Share"]}>
              {analytics.collections.map((c) => (
                <tr key={c.name} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3">{c.qty}</td>
                  <td className="px-3 py-3">{money(c.revenue)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full bg-[var(--gold)]"
                          style={{ width: `${Math.min(100, c.sharePct)}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--muted)]">{c.sharePct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Inventory actions" action={<Badge tone="warn">Reorder / reduce</Badge>}>
          {analytics.reorderHints.length === 0 ? (
            <EmptyState
              title="No urgent stock actions"
              description="Collection cover looks balanced for this period."
            />
          ) : (
            <DataTable headers={["Collection", "Sold", "Stock", "Action"]}>
              {analytics.reorderHints.map((r) => (
                <tr key={r.collection} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{r.collection}</td>
                  <td className="px-3 py-3">{r.sold}</td>
                  <td className="px-3 py-3">{r.stock}</td>
                  <td className="px-3 py-3">
                    <Badge tone={r.action === "reorder" ? "danger" : "warn"}>{r.action}</Badge>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card title="Dead-stock detection" action={<Badge tone="danger">High idle</Badge>}>
          {analytics.deadStock.length === 0 ? (
            <EmptyState title="No dead stock flagged" description="Nothing meets the high-idle threshold." />
          ) : (
            <DataTable headers={["Product", "Days", "Value", "Action"]}>
              {analytics.deadStock.map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3">
                    <Link
                      href={`/inventory/${p.id}/edit`}
                      className="font-medium text-[var(--gold-deep)] hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{p.sku}</p>
                  </td>
                  <td className="px-3 py-3">{p.daysIdle}d</td>
                  <td className="px-3 py-3">{money(p.stockValue)}</td>
                  <td className="px-3 py-3 text-xs">{p.actionLabel}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Anomaly detection" action={<Badge tone="warn">Review</Badge>}>
          {analytics.anomalies.length === 0 ? (
            <EmptyState
              title="No anomalies"
              description="Discounts and returns look within normal bounds."
            />
          ) : (
            <ul className="space-y-3">
              {analytics.anomalies.map((a, i) => (
                <li
                  key={`${a.type}-${i}`}
                  className="rounded-xl border border-[var(--border)] bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="mt-0.5 text-sm text-[var(--muted)]">{a.detail}</p>
                    </div>
                    <Badge tone={a.severity === "high" ? "danger" : "warn"}>{a.severity}</Badge>
                  </div>
                  {a.href ? (
                    <Link
                      href={a.href}
                      className="mt-2 inline-block text-xs text-[var(--gold-deep)] hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card title="VIP customer scoring" action={<Badge tone="gold">High-value</Badge>}>
          {analytics.vipScores.length === 0 ? (
            <EmptyState
              title="No VIP scores yet"
              description="Need higher-ticket or repeat customer history."
            />
          ) : (
            <DataTable headers={["Client", "VIP score", "Tier", "Next action"]}>
              {analytics.vipScores.map((c) => (
                <tr key={`vip-${c.key}`} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">
                    {c.id ? (
                      <Link href={`/customers/${c.id}`} className="text-[var(--gold-deep)] hover:underline">
                        {c.name}
                      </Link>
                    ) : (
                      c.name
                    )}
                    <p className="text-xs text-[var(--muted)]">Avg {money(c.avgOrder)}</p>
                  </td>
                  <td className="px-3 py-3">{c.vipScore}</td>
                  <td className="px-3 py-3">
                    <Badge
                      tone={c.tier === "platinum" ? "gold" : c.tier === "gold" ? "success" : "neutral"}
                    >
                      {c.tier}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">{c.nextAction}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Product recommendations" action={<Badge tone="info">Per client</Badge>}>
          {analytics.recommendations.length === 0 ? (
            <EmptyState
              title="No recommendations"
              description="VIP scores + in-stock items drive suggestions."
            />
          ) : (
            <DataTable headers={["Customer", "Suggest", "Price", "Why"]}>
              {analytics.recommendations.map((r, i) => (
                <tr key={`${r.customerName}-${i}`} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{r.customerName}</td>
                  <td className="px-3 py-3">
                    {r.suggestName}
                    {r.suggestSku ? (
                      <p className="text-xs text-[var(--muted)]">{r.suggestSku}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{money(r.suggestPrice)}</td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">{r.reason}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card
          title="Staff analytics"
          action={
            analytics.staffDeep[0] ? (
              <Badge tone="success">Lead: {analytics.staffDeep[0].name}</Badge>
            ) : null
          }
        >
          {analytics.staffDeep.length === 0 ? (
            <EmptyState
              title="No staff sales"
              description="Assign a salesperson on invoices to compare performance."
            />
          ) : (
            <DataTable headers={["Staff", "Invoices", "Avg ticket", "Discount %", "Repeats"]}>
              {analytics.staffDeep.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{s.name}</td>
                  <td className="px-3 py-3">{s.invoices}</td>
                  <td className="px-3 py-3">{money(s.avgTicket)}</td>
                  <td className="px-3 py-3">{s.discountPct.toFixed(1)}%</td>
                  <td className="px-3 py-3">{s.repeatCustomers}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Pricing guidance" action={<Badge tone="warn">Margin guard</Badge>}>
          <p className="mb-3 text-sm text-[var(--muted)]">{analytics.pricingGuidance.note}</p>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border)] px-4 py-3">
              <p className="text-xs text-[var(--muted)]">Avg discount</p>
              <p className="text-xl font-medium">
                {analytics.pricingGuidance.avgDiscountPct.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] px-4 py-3">
              <p className="text-xs text-[var(--muted)]">Suggested max</p>
              <p className="text-xl font-medium text-[var(--gold-deep)]">
                {analytics.pricingGuidance.recommendedMaxDiscountPct}%
              </p>
            </div>
          </div>
          {analytics.pricingGuidance.highDiscountInvoices.length === 0 ? (
            <EmptyState
              title="No over-cap discounts"
              description="Discounts stayed within the suggested limit."
            />
          ) : (
            <DataTable headers={["Invoice", "Staff", "Discount %"]}>
              {analytics.pricingGuidance.highDiscountInvoices.map((d) => (
                <tr key={d.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3">
                    <Link href={`/sales/${d.id}`} className="text-[var(--gold-deep)] hover:underline">
                      {d.invoice}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{d.employee}</td>
                  <td className="px-3 py-3">{d.discountPct.toFixed(1)}%</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card
          title="Production planning"
          action={<Badge tone="info">{analytics.productionPlan.openJobs} open</Badge>}
        >
          <p className="mb-3 text-sm text-[var(--muted)]">{analytics.productionPlan.suggestion}</p>
          <p className="mb-2 text-sm">
            Labour in pipeline: <strong>{money(analytics.productionPlan.labourPipeline)}</strong>
          </p>
          {analytics.productionPlan.metalIssued.length === 0 ? (
            <EmptyState
              title="No open metal issue"
              description="Create manufacturing jobs to see factory metal needs."
            />
          ) : (
            <DataTable headers={["Metal", "Issued (g)"]}>
              {analytics.productionPlan.metalIssued.map((m) => (
                <tr key={m.metal} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">{m.metal}</td>
                  <td className="px-3 py-3">{m.grams.toFixed(2)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Bestsellers" action={<Badge tone="gold">Period</Badge>}>
          {analytics.bestsellers.length === 0 ? (
            <EmptyState title="No bestsellers" description="Sell linked products to rank movers." />
          ) : (
            <DataTable headers={["Product", "Collection", "Qty", "Revenue"]}>
              {analytics.bestsellers.map((b) => (
                <tr key={b.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3">
                    <span className="font-medium">{b.name}</span>
                    <p className="text-xs text-[var(--muted)]">{b.sku}</p>
                  </td>
                  <td className="px-3 py-3">{b.collection}</td>
                  <td className="px-3 py-3">{b.qty}</td>
                  <td className="px-3 py-3">{money(b.revenue)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mb-8">
        <Card title="Which products stay in stock too long?" action={<Badge tone="warn">Idle 60+ days</Badge>}>
          {analytics.slowMovers.length === 0 ? (
            <EmptyState
              title="No ageing stock"
              description="Nothing has sat idle for 60 days or more — stock is turning over."
            />
          ) : (
            <DataTable headers={["Product", "Collection", "Qty", "Days idle", "Tied value", "Risk"]}>
              {analytics.slowMovers.map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3">
                    <Link
                      href={`/inventory/${p.id}/edit`}
                      className="font-medium text-[var(--gold-deep)] hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{p.sku}</p>
                  </td>
                  <td className="px-3 py-3">{p.collection}</td>
                  <td className="px-3 py-3">{p.quantity}</td>
                  <td className="px-3 py-3">
                    {p.daysIdle}d
                    <p className="text-xs text-[var(--muted)]">
                      {p.neverSold
                        ? `Since added ${formatDate(p.createdAt)}`
                        : `Last sold ${formatDate(p.lastSoldAt!)}`}
                    </p>
                  </td>
                  <td className="px-3 py-3">{money(p.stockValue)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={p.risk === "high" ? "danger" : p.risk === "medium" ? "warn" : "neutral"}>
                      {p.risk}
                    </Badge>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card title="Which customers are likely to buy again?" action={<Badge tone="info">RFM score</Badge>}>
          {analytics.likelyBuyers.length === 0 ? (
            <EmptyState
              title="Not enough customer history"
              description="Link customers on sales to predict repeat purchases."
            />
          ) : (
            <DataTable headers={["Customer", "Visits", "Spent", "Likelihood"]}>
              {analytics.likelyBuyers.map((c) => (
                <tr key={c.key} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3">
                    {c.id ? (
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium text-[var(--gold-deep)] hover:underline"
                      >
                        {c.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                    <p className="text-xs text-[var(--muted)]">{c.reason}</p>
                  </td>
                  <td className="px-3 py-3">{c.purchases}</td>
                  <td className="px-3 py-3">{money(c.revenue)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={c.likelihood === "high" ? "success" : "info"}>
                      {c.likelihood} · {c.score}
                    </Badge>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card title="Win-back: quiet repeat buyers" action={<Badge tone="warn">180+ days</Badge>}>
          {analytics.atRiskCustomers.length === 0 ? (
            <EmptyState
              title="No quiet repeaters"
              description="Repeat customers are still active — no 180-day gaps flagged."
            />
          ) : (
            <DataTable headers={["Customer", "Past visits", "Lifetime value", "Quiet for"]}>
              {analytics.atRiskCustomers.map((c) => (
                <tr key={`risk-${c.id ?? c.name}`} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 font-medium">
                    {c.id ? (
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-[var(--gold-deep)] hover:underline"
                      >
                        {c.name}
                      </Link>
                    ) : (
                      c.name
                    )}
                  </td>
                  <td className="px-3 py-3">{c.purchases}</td>
                  <td className="px-3 py-3">{money(c.revenue)}</td>
                  <td className="px-3 py-3">{c.recencyDays}d</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
