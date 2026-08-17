import Link from "next/link";
import { getTrialBalance } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Badge, Card, DataTable, PageHeader } from "@/components/ui";
import {
  DateRangeToolbar,
  ReportPrintHeader,
  formatPeriodLabel,
  parseReportDates,
} from "@/components/ReportControls";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { from, to, fromValue, toValue } = parseReportDates(params);
  const [tb, settings] = await Promise.all([
    getTrialBalance(from, to),
    prisma.shopSettings.findFirst(),
  ]);
  const period = formatPeriodLabel(from, to);
  const currency = settings?.currency ?? "INR";
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Trial Balance"
          description={`Period movements · ${period} · ${currency}. Debits must equal credits.`}
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
        title="Trial Balance"
        subtitle={period}
        address={settings?.address}
        phone={settings?.phone}
        email={settings?.email}
        gstin={settings?.gstin}
        logoUrl={settings?.logoUrl}
      />

      <div className="mb-4 no-print">
        <Badge tone={tb.balanced ? "success" : "danger"}>
          {tb.balanced ? "Books balanced" : "Out of balance — review journals"}
        </Badge>
      </div>

      <div className="print-report">
        <Card>
          <DataTable headers={["Code", "Account", "Type", "Debit", "Credit"]}>
            {tb.rows.map((r) => (
              <tr key={r.id} className="hover:bg-stone-50/80">
                <td className="px-3 py-3 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-3 font-medium">{r.name}</td>
                <td className="px-3 py-3">
                  <Badge tone="neutral">{r.type}</Badge>
                </td>
                <td className="px-3 py-3 text-right">
                  {r.trialDebit > 0 ? money(r.trialDebit) : "—"}
                </td>
                <td className="px-3 py-3 text-right">
                  {r.trialCredit > 0 ? money(r.trialCredit) : "—"}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--ink)]/20 font-semibold">
              <td className="px-3 py-3" colSpan={3}>
                Total
              </td>
              <td className="px-3 py-3 text-right">{money(tb.totalDebit)}</td>
              <td className="px-3 py-3 text-right">{money(tb.totalCredit)}</td>
            </tr>
          </DataTable>
        </Card>
      </div>
    </div>
  );
}
