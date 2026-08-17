import Link from "next/link";
import { getProfitAndLoss } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, DataTable, PageHeader, StatCard } from "@/components/ui";
import {
  DateRangeToolbar,
  ReportPrintHeader,
  formatPeriodLabel,
  parseReportDates,
} from "@/components/ReportControls";

export const dynamic = "force-dynamic";

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { from, to, fromValue, toValue } = parseReportDates(params);
  const [pl, settings] = await Promise.all([
    getProfitAndLoss(from, to),
    prisma.shopSettings.findFirst(),
  ]);
  const period = formatPeriodLabel(from, to);
  const currency = settings?.currency ?? "INR";
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Profit & Loss"
          description={`Income statement for ${period} · ${currency}.`}
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
        title="Profit & Loss Statement"
        subtitle={period}
        address={settings?.address}
        phone={settings?.phone}
        email={settings?.email}
        gstin={settings?.gstin}
        logoUrl={settings?.logoUrl}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3 print:grid-cols-3">
        <StatCard label="Income" value={money(pl.totalIncome)} />
        <StatCard label="Expenses" value={money(pl.totalExpenses)} />
        <StatCard label="Net Profit / (Loss)" value={money(pl.netProfit)} accent />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
        <Card title="Income">
          <DataTable headers={["Code", "Account", "Amount"]}>
            {pl.income.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-3">{r.name}</td>
                <td className="px-3 py-3 text-right font-medium">{money(r.amount)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-3 py-3" colSpan={2}>
                Total Income
              </td>
              <td className="px-3 py-3 text-right">{money(pl.totalIncome)}</td>
            </tr>
          </DataTable>
        </Card>
        <Card title="Expenses">
          <DataTable headers={["Code", "Account", "Amount"]}>
            {pl.expenses.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-3">{r.name}</td>
                <td className="px-3 py-3 text-right font-medium">{money(r.amount)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-3 py-3" colSpan={2}>
                Total Expenses
              </td>
              <td className="px-3 py-3 text-right">{money(pl.totalExpenses)}</td>
            </tr>
          </DataTable>
        </Card>
      </div>
    </div>
  );
}
