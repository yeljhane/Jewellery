import Link from "next/link";
import {
  getBalanceSheet,
  getDayBook,
  getProfitAndLoss,
  getTrialBalance,
  syncAccountingFromOperations,
} from "@/lib/accounting";
import { getShopCurrency } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import { Card, PageHeader, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

const links = [
  {
    href: "/accounting/trial-balance",
    title: "Trial Balance",
    desc: "Debit and credit totals by account — books must balance.",
  },
  {
    href: "/accounting/profit-loss",
    title: "Profit & Loss",
    desc: "Income vs expenses for the period.",
  },
  {
    href: "/accounting/balance-sheet",
    title: "Balance Sheet",
    desc: "Assets, liabilities, and equity position.",
  },
  {
    href: "/accounting/day-book",
    title: "Day Book / Journal",
    desc: "All journal vouchers with double-entry lines.",
  },
  {
    href: "/accounting/ledger",
    title: "Account Ledger",
    desc: "Running balance for any chart-of-accounts head.",
  },
  {
    href: "/accounting/chart",
    title: "Chart of Accounts",
    desc: "Standard jewellery shop ledger heads.",
  },
];

export default async function AccountingPage() {
  await syncAccountingFromOperations();
  const [tb, pl, bs, dayBook, currency] = await Promise.all([
    getTrialBalance(),
    getProfitAndLoss(),
    getBalanceSheet(),
    getDayBook(),
    getShopCurrency(),
  ]);
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div>
      <PageHeader
        title="Accounting"
        description={`Double-entry books synced from sales, purchases, and expenses · ${currency}.`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net Profit"
          value={money(pl.netProfit)}
          hint={pl.netProfit >= 0 ? "Surplus" : "Deficit"}
          accent
        />
        <StatCard label="Total Income" value={money(pl.totalIncome)} />
        <StatCard label="Total Expenses" value={money(pl.totalExpenses)} />
        <StatCard
          label="Trial Balance"
          value={tb.balanced ? "Balanced" : "Check"}
          hint={`${money(tb.totalDebit)} Dr`}
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Assets</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">
            {money(bs.totalAssets)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Liabilities</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">
            {money(bs.totalLiabilities)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Equity + P&L</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">
            {money(bs.totalEquity)}
          </p>
        </Card>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--gold)]"
          >
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
              {l.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{l.desc}</p>
          </Link>
        ))}
      </div>

      <Card title="Recent Journals">
        <ul className="divide-y divide-[var(--border)] text-sm">
          {dayBook.slice(0, 8).map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <span className="font-medium text-[var(--gold-deep)]">{j.entryNumber}</span>
                <span className="mx-2 text-[var(--muted)]">·</span>
                <span>{j.narration}</span>
              </div>
              <span className="text-[var(--muted)]">
                {money(j.lines.reduce((s, l) => s + l.debit, 0))}
              </span>
            </li>
          ))}
          {dayBook.length === 0 ? (
            <li className="py-6 text-[var(--muted)]">No journals yet.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
