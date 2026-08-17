import Link from "next/link";
import { getBalanceSheet } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge, Card, DataTable, PageHeader, StatCard } from "@/components/ui";
import {
  DateRangeToolbar,
  ReportPrintHeader,
  formatPeriodLabel,
  parseReportDates,
} from "@/components/ReportControls";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { from, to, fromValue, toValue } = parseReportDates(params);
  const [bs, settings] = await Promise.all([
    getBalanceSheet(to, from),
    prisma.shopSettings.findFirst(),
  ]);
  const period = formatPeriodLabel(from, to);
  const currency = settings?.currency ?? "INR";
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Balance Sheet"
          description={`Position as of end date · P&L for ${period} · ${currency}.`}
          actions={
            <Link href="/accounting" className="text-sm text-[var(--gold-deep)] hover:underline">
              Accounting home
            </Link>
          }
        />
        <DateRangeToolbar fromValue={fromValue} toValue={toValue} />
      </div>

      <ReportPrintHeader
        shopName={settings?.shopName ?? "Avenue JOAILLERIE"}
        title="Balance Sheet"
        subtitle={`As of ${toValue} · P&L ${period}`}
        address={settings?.address}
        phone={settings?.phone}
        email={settings?.email}
        gstin={settings?.gstin}
        logoUrl={settings?.logoUrl}
      />

      <div className="mb-4 no-print">
        <Badge tone={bs.balanced ? "success" : "warn"}>
          {bs.balanced ? "Assets = Liabilities + Equity" : "Equation check needed"}
        </Badge>
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3 print:grid-cols-3">
        <StatCard label="Total Assets" value={money(bs.totalAssets)} accent />
        <StatCard label="Total Liabilities" value={money(bs.totalLiabilities)} />
        <StatCard label="Equity (incl. P&L)" value={money(bs.totalEquity)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
        <Card title="Assets">
          <DataTable headers={["Code", "Account", "Amount"]}>
            {bs.assets.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-3">{r.name}</td>
                <td className="px-3 py-3 text-right">{money(r.amount)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={2} className="px-3 py-3">
                Total Assets
              </td>
              <td className="px-3 py-3 text-right">{money(bs.totalAssets)}</td>
            </tr>
          </DataTable>
        </Card>
        <div className="space-y-6">
          <Card title="Liabilities">
            <DataTable headers={["Code", "Account", "Amount"]}>
              {bs.liabilities.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-3">{r.name}</td>
                  <td className="px-3 py-3 text-right">{money(r.amount)}</td>
                </tr>
              ))}
              {bs.liabilities.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-[var(--muted)]">
                    No liability balances
                  </td>
                </tr>
              ) : null}
              <tr className="font-semibold">
                <td colSpan={2} className="px-3 py-3">
                  Total Liabilities
                </td>
                <td className="px-3 py-3 text-right">{money(bs.totalLiabilities)}</td>
              </tr>
            </DataTable>
          </Card>
          <Card title="Equity">
            <DataTable headers={["Account", "Amount"]}>
              {bs.equity.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-3">
                    {r.code} — {r.name}
                  </td>
                  <td className="px-3 py-3 text-right">{money(r.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-3">Period P&L</td>
                <td className="px-3 py-3 text-right">{money(bs.netProfit)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="px-3 py-3">Total Equity</td>
                <td className="px-3 py-3 text-right">{money(bs.totalEquity)}</td>
              </tr>
            </DataTable>
          </Card>
        </div>
      </div>
    </div>
  );
}
