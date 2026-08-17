"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

export type SaleCustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  vipTier?: string | null;
};

export function SaleCustomerField({
  customers,
  defaultCustomerId = "",
  defaultCustomerName = "",
}: {
  customers: SaleCustomerOption[];
  defaultCustomerId?: string;
  defaultCustomerName?: string;
}) {
  const selected = customers.find((c) => c.id === defaultCustomerId);
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [name, setName] = useState(defaultCustomerName || selected?.name || "");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => {
        const hay = `${c.name} ${c.phone ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [customers, name]);

  function pick(c: SaleCustomerOption) {
    setCustomerId(c.id);
    setName(c.name);
    setOpen(false);
  }

  function clear() {
    setCustomerId("");
    setName("");
    setOpen(false);
  }

  return (
    <div className="relative space-y-1.5">
      <input type="hidden" name="customerId" value={customerId} />
      <span className="text-xs font-medium text-[var(--muted)]">Customer</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          name="customerName"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setCustomerId("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type name, or pick from list…"
          autoComplete="off"
          className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-9 pr-10 text-sm outline-none ring-[var(--gold)]/30 placeholder:text-stone-400 focus:ring-2"
        />
        {name ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted)] hover:bg-stone-100"
            aria-label="Clear customer"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-[var(--muted)]">
        {customerId
          ? (() => {
              const c = customers.find((x) => x.id === customerId);
              const vip =
                c?.vipTier && c.vipTier !== "STANDARD" ? ` · VIP ${c.vipTier}` : "";
              return `Linked to saved customer${vip}`;
            })()
          : name.trim()
            ? "Will save as typed name (walk-in)"
            : "Leave blank for Walk-in"}
      </p>

      {open && results.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[var(--border)] bg-white shadow-lg">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c)}
              className="flex w-full items-center justify-between border-b border-[var(--border)] px-3 py-2.5 text-left text-sm last:border-0 hover:bg-stone-50"
            >
              <span className="font-medium text-[var(--ink)]">
                {c.name}
                {c.vipTier && c.vipTier !== "STANDARD" ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--gold-deep)]">
                    {c.vipTier}
                  </span>
                ) : null}
              </span>
              {c.phone ? (
                <span className="text-xs text-[var(--muted)]">{c.phone}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
