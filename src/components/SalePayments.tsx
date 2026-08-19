"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  PAYMENT_CURRENCIES,
  convertFromBase,
  convertToBase,
  fallbackRate,
  roundMoney,
} from "@/lib/currency";

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "BANK", label: "Bank Transfer" },
] as const;

type PaymentRow = {
  key: string;
  method: string;
  currency: string;
  foreignAmount: string;
  exchangeRate: string;
  reference: string;
  rateSource: "live" | "fallback" | "manual";
};

function formatMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function newRow(baseCurrency: string, method = "CASH", foreignAmount = ""): PaymentRow {
  return {
    key: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    method,
    currency: baseCurrency,
    foreignAmount,
    exchangeRate: "1",
    reference: "",
    rateSource: "live",
  };
}

export function SalePayments({
  dueAmount,
  baseCurrency = "AZN",
  initialPayments,
}: {
  dueAmount: number;
  baseCurrency?: string;
  initialPayments?: Array<{
    method: string;
    amount: number;
    currency?: string | null;
    foreignAmount?: number | null;
    exchangeRate?: number | null;
    reference?: string | null;
  }>;
}) {
  const base = (baseCurrency || "AZN").toUpperCase();

  const seeded =
    initialPayments && initialPayments.length > 0
      ? initialPayments.map((p) => {
          const currency = (p.currency || base).toUpperCase();
          const rate = p.exchangeRate && p.exchangeRate > 0 ? p.exchangeRate : 1;
          const foreign =
            p.foreignAmount != null && p.foreignAmount > 0
              ? p.foreignAmount
              : currency === base
                ? p.amount
                : convertFromBase(p.amount, rate);
          return {
            key: `pay-${p.method}-${currency}-${Math.random().toString(36).slice(2, 6)}`,
            method: p.method,
            currency,
            foreignAmount: String(foreign),
            exchangeRate: String(rate),
            reference: p.reference ?? "",
            rateSource: "manual" as const,
          };
        })
      : [newRow(base, "CASH", "")];

  const [rows, setRows] = useState<PaymentRow[]>(seeded);
  const [touched, setTouched] = useState(Boolean(initialPayments?.length));
  const [fetchingKey, setFetchingKey] = useState<string | null>(null);

  const loadRate = useCallback(
    async (key: string, from: string, to: string) => {
      if (from.toUpperCase() === to.toUpperCase()) {
        setRows((prev) =>
          prev.map((r) =>
            r.key === key
              ? { ...r, exchangeRate: "1", rateSource: "live" as const }
              : r
          )
        );
        return;
      }
      setFetchingKey(key);
      try {
        const res = await fetch(
          `/api/exchange-rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
        const data = await res.json();
        const rate =
          typeof data.rate === "number" && data.rate > 0
            ? data.rate
            : fallbackRate(from, to);
        setRows((prev) =>
          prev.map((r) =>
            r.key === key
              ? {
                  ...r,
                  exchangeRate: String(rate),
                  rateSource: (data.source === "live" ? "live" : "fallback") as
                    | "live"
                    | "fallback",
                }
              : r
          )
        );
      } catch {
        setRows((prev) =>
          prev.map((r) =>
            r.key === key
              ? {
                  ...r,
                  exchangeRate: String(fallbackRate(from, to)),
                  rateSource: "fallback" as const,
                }
              : r
          )
        );
      } finally {
        setFetchingKey(null);
      }
    },
    []
  );

  // Keep a single untouched cash row in sync with the bill total (base currency)
  useEffect(() => {
    if (touched) return;
    setRows([
      newRow(base, "CASH", dueAmount > 0 ? String(roundMoney(dueAmount, 2)) : ""),
    ]);
  }, [dueAmount, touched, base]);

  const rowBaseAmount = (r: PaymentRow) =>
    convertToBase(Number(r.foreignAmount) || 0, Number(r.exchangeRate) || 1);

  const paid = rows.reduce((s, r) => s + rowBaseAmount(r), 0);
  const balance = roundMoney(dueAmount - paid, 2);

  const payload = rows
    .map((r) => {
      const foreignAmount = Number(r.foreignAmount) || 0;
      const exchangeRate = Number(r.exchangeRate) || 1;
      const amount = convertToBase(foreignAmount, exchangeRate);
      return {
        method: r.method,
        currency: r.currency,
        foreignAmount,
        exchangeRate,
        amount,
        reference: r.reference.trim() || null,
      };
    })
    .filter((r) => r.amount > 0);

  function updateRow(key: string, patch: Partial<PaymentRow>) {
    setTouched(true);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function changeCurrency(key: string, currency: string) {
    setTouched(true);
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, currency } : r))
    );
    await loadRate(key, currency, base);
  }

  function addRow(method = "CARD") {
    setTouched(true);
    const remaining = Math.max(0, balance);
    setRows((prev) => [
      ...prev,
      newRow(base, method, remaining > 0 ? String(roundMoney(remaining, 2)) : ""),
    ]);
  }

  function removeRow(key: string) {
    setTouched(true);
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  function fillRemaining(key: string) {
    setTouched(true);
    setRows((prev) => {
      const others = prev
        .filter((r) => r.key !== key)
        .reduce((s, r) => s + rowBaseAmount(r), 0);
      const fillBase = Math.max(0, roundMoney(dueAmount - others, 2));
      return prev.map((r) => {
        if (r.key !== key) return r;
        const rate = Number(r.exchangeRate) || 1;
        return {
          ...r,
          foreignAmount: String(convertFromBase(fillBase, rate)),
        };
      });
    });
  }

  return (
    <div className="md:col-span-2 space-y-3">
      <input type="hidden" name="paymentsJson" value={JSON.stringify(payload)} />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg">Payments</h3>
            <p className="text-xs text-[var(--muted)]">
              Pay in any currency — amounts auto-convert to {base}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => addRow("CARD")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-[var(--ink)] hover:bg-stone-50"
          >
            <Plus className="h-4 w-4" />
            Add payment
          </button>
        </div>

        <ul className="divide-y divide-[var(--border)]">
          {rows.map((row, idx) => {
            const baseAmt = rowBaseAmount(row);
            const isFx = row.currency.toUpperCase() !== base;
            return (
              <li key={row.key} className="space-y-2 p-4">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">Method {idx + 1}</span>
                    <select
                      value={row.method}
                      onChange={(e) => updateRow(row.key, { method: e.target.value })}
                      className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-2 text-sm"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">Currency</span>
                    <select
                      value={row.currency}
                      onChange={(e) => changeCurrency(row.key, e.target.value)}
                      className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-2 text-sm"
                    >
                      {PAYMENT_CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">Amount ({row.currency})</span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.foreignAmount}
                        onChange={(e) =>
                          updateRow(row.key, { foreignAmount: e.target.value })
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-2 text-sm"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => fillRemaining(row.key)}
                        className="shrink-0 rounded-md border border-[var(--border)] px-2 text-xs text-[var(--muted)] hover:bg-stone-50"
                        title="Fill remaining balance"
                      >
                        Fill
                      </button>
                    </div>
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">
                      Rate → {base}
                      {row.rateSource === "live"
                        ? " · live"
                        : row.rateSource === "fallback"
                          ? " · approx"
                          : " · manual"}
                    </span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={row.exchangeRate}
                        onChange={(e) =>
                          updateRow(row.key, {
                            exchangeRate: e.target.value,
                            rateSource: "manual",
                          })
                        }
                        disabled={!isFx}
                        className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-2 text-sm disabled:bg-stone-50"
                      />
                      {isFx ? (
                        <button
                          type="button"
                          onClick={() => loadRate(row.key, row.currency, base)}
                          disabled={fetchingKey === row.key}
                          className="shrink-0 rounded-md border border-[var(--border)] px-2 text-[var(--muted)] hover:bg-stone-50 disabled:opacity-50"
                          title="Refresh live rate"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${fetchingKey === row.key ? "animate-spin" : ""}`}
                          />
                        </button>
                      ) : null}
                    </div>
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length <= 1}
                      className="rounded-lg p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-30"
                      aria-label="Remove payment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                  <span>
                    {isFx
                      ? `${formatMoney(Number(row.foreignAmount) || 0, row.currency)} × ${row.exchangeRate} = ${formatMoney(baseAmt, base)}`
                      : `In ${base}`}
                  </span>
                  <label className="flex items-center gap-2">
                    <span>Ref</span>
                    <input
                      value={row.reference}
                      onChange={(e) => updateRow(row.key, { reference: e.target.value })}
                      placeholder="Txn / cheque no."
                      className="rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="space-y-1 border-t border-[var(--border)] px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Bill total ({base})</span>
            <span>{formatMoney(dueAmount, base)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Paid now ({base})</span>
            <span>{formatMoney(paid, base)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span className={balance > 0.01 ? "text-amber-800" : "text-emerald-800"}>
              {balance > 0.01 ? "Balance due" : balance < -0.01 ? "Overpaid" : "Settled"}
            </span>
            <span className={balance > 0.01 ? "text-amber-800" : "text-emerald-800"}>
              {formatMoney(Math.abs(balance), base)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
