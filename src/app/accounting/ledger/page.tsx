import Link from "next/link";
import { getLedger, syncAccountingFromOperations } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, DataTable, EmptyState, PageHeader, Select } from "@/components/ui";
import {
  DateRangeToolbar,
  ReportPrintHeader,
  formatPeriodLabel,
  parseReportDates,
} from "@/components/ReportControls";

export const dynamic = "force-dynamic";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; from?: string; to?: string }>;
}) {
  await syncAccountingFromOperations();
  const params = await searchParams;
  const { from, to, fromValue, toValue } = parseReportDates(params);
  const [accounts, settings] = await Promise.all([
    prisma.account.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.shopSettings.findFirst(),
  ]);
  const selected = params.accountId || accounts[0]?.id;
  const ledger = selected ? await getLedger(selected, from, to) : null;
  const period = formatPeriodLabel(from, to);
  const currency = settings?.currency ?? "INR";
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Account Ledger"
          description={`Running balance for ${period} · ${currency}.`}
          actions={
            <Link href="/accounting" className="text-sm text-[var(--gold-deep)] hover:underline">
              Accounting home
            </Link>
          }
        />
        <DateRangeToolbar
          fromValue={fromValue}
          toValue={toValue}
          extraFields={
            <div className="min-w-[240px] flex-1">
              <Select label="Account" name="accountId" defaultValue={selected}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
      </div>

      {ledger ? (
        <>
          <ReportPrintHeader
            shopName={settings?.shopName ?? "Avenue JOAILLERIE"}
            title={`Ledger — ${ledger.account.code} ${ledger.account.name}`}
            subtitle={period}
            address={settings?.address}
            phone={settings?.phone}
            email={settings?.email}
            gstin={settings?.gstin}
            logoUrl={settings?.logoUrl}
          />
          <Card
            title={`${ledger.account.code} — ${ledger.account.name}`}
            action={
              <span className="text-sm text-[var(--muted)]">
                Closing:{" "}
                <strong className="text-[var(--ink)]">
                  {money(Math.abs(ledger.closing))}
                </strong>{" "}
                {ledger.closing >= 0 ? "Dr" : "Cr"}
              </span>
            }
          >
            {ledger.rows.length === 0 ? (
              <EmptyState
                title="No movements"
                description="No journal lines for this account in the selected period."
              />
            ) : (
              <DataTable headers={["Date", "Voucher", "Narration", "Debit", "Credit", "Balance"]}>
                {ledger.rows.map((r, i) => (
                  <tr key={`${r.entryNumber}-${i}`} className="hover:bg-stone-50/80">
                    <td className="px-3 py-3 text-[var(--muted)]">{formatDate(r.date)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-[var(--gold-deep)]">
                      {r.entryNumber}
                    </td>
                    <td className="px-3 py-3">{r.narration}</td>
                    <td className="px-3 py-3 text-right">
                      {r.debit > 0 ? money(r.debit) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.credit > 0 ? money(r.credit) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {money(Math.abs(r.balance))} {r.balance >= 0 ? "Dr" : "Cr"}
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
