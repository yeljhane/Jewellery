import Link from "next/link";
import { createManualJournal } from "@/lib/actions";
import { ActionForm } from "@/components/ActionForm";
import { getDayBook } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import {
  DateRangeToolbar,
  ReportPrintHeader,
  formatPeriodLabel,
  parseReportDates,
} from "@/components/ReportControls";

export const dynamic = "force-dynamic";

export default async function DayBookPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { from, to, fromValue, toValue } = parseReportDates(params);
  const [entries, accounts, settings] = await Promise.all([
    getDayBook(from, to),
    prisma.account.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.shopSettings.findFirst(),
  ]);
  const period = formatPeriodLabel(from, to);
  const currency = settings?.currency ?? "AZN";
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Day Book / Journal"
          description={`Vouchers for ${period} · ${currency}. Sales, purchases, and expenses post automatically.`}
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
        title="Day Book / Journal Register"
        subtitle={period}
        address={settings?.address}
        phone={settings?.phone}
        email={settings?.email}
        gstin={settings?.gstin}
        logoUrl={settings?.logoUrl}
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card title="Manual Journal Entry" className="no-print lg:col-span-1">
          <ActionForm action={createManualJournal} successMessage="The journal entry was added successfully." className="space-y-3">
            <Input label="Date" name="entryDate" type="date" />
            <Input label="Narration" name="narration" required placeholder="Bank deposit / adjustment" />
            <Select label="Debit Account" name="debitCode" required defaultValue="1000">
              {accounts.map((a) => (
                <option key={a.id} value={a.code}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
            <Select label="Credit Account" name="creditCode" required defaultValue="1010">
              {accounts.map((a) => (
                <option key={a.id} value={a.code}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
            <Input label="Amount" name="amount" type="number" step="0.01" required />
            <Button type="submit">Post Entry</Button>
          </ActionForm>
        </Card>

        <Card title="Journal Register" className="lg:col-span-2 print:col-span-full">
          <div className="space-y-6">
            {entries.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No journal entries in this period.</p>
            ) : (
              entries.map((j) => (
                <div key={j.id} className="rounded-xl border border-[var(--border)] p-4 print:break-inside-avoid">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-[var(--gold-deep)]">{j.entryNumber}</span>
                      <span className="mx-2 text-[var(--muted)]">·</span>
                      <span className="text-sm">{j.narration}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      {formatDate(j.entryDate)}
                      {j.sourceType ? <Badge tone="info">{j.sourceType}</Badge> : null}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
                        <th className="pb-2 text-left font-medium">Account</th>
                        <th className="pb-2 text-right font-medium">Debit</th>
                        <th className="pb-2 text-right font-medium">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {j.lines.map((l) => (
                        <tr key={l.id} className="border-t border-[var(--border)]">
                          <td className="py-2">
                            <span className="font-mono text-xs text-[var(--muted)]">
                              {l.account.code}
                            </span>{" "}
                            {l.account.name}
                          </td>
                          <td className="py-2 text-right">
                            {l.debit > 0 ? money(l.debit) : ""}
                          </td>
                          <td className="py-2 text-right">
                            {l.credit > 0 ? money(l.credit) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
