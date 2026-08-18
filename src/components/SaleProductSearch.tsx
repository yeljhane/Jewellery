"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { calcJewelleryAmount } from "@/lib/utils";
import { SalePayments } from "@/components/SalePayments";

export type SaleProductOption = {
  id: string;
  sku: string;
  name: string;
  jewelleryType: string;
  metal: string;
  purity: string | null;
  netWeight: number;
  makingCharge: number;
  stoneDetails: string | null;
  sellingPrice: number;
  quantity: number;
  imageUrl: string | null;
  wastagePct?: number;
};

type CartLine = {
  key: string;
  productId: string;
  sku: string;
  description: string;
  metal: string;
  purity: string;
  netWeight: number;
  quantity: number;
  makingCharge: number;
  stoneCharge: number;
  wastagePct: number;
  imageUrl: string | null;
  stockQty: number;
};

function formatMoney(n: number, currency = "AZN") {
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

export function SaleProductSearch({
  products,
  defaultMetalRate = 0,
  initialLines,
  initialDiscount = 0,
  initialTaxPct = 3,
  initialPayments,
  baseCurrency = "AZN",
  jewelleryScope = "ALL",
}: {
  products: SaleProductOption[];
  defaultMetalRate?: number;
  initialLines?: Array<{
    productId?: string | null;
    description: string;
    metal?: string | null;
    purity?: string | null;
    netWeight: number;
    quantity: number;
    makingCharge: number;
    stoneCharge: number;
    metalRate?: number;
    imageUrl?: string | null;
    sku?: string;
    stockQty?: number;
    wastagePct?: number;
  }>;
  initialDiscount?: number;
  initialTaxPct?: number;
  initialPayments?: Array<{
    method: string;
    amount: number;
    currency?: string | null;
    foreignAmount?: number | null;
    exchangeRate?: number | null;
    reference?: string | null;
  }>;
  baseCurrency?: string;
  jewelleryScope?: "GOLD" | "DIAMOND" | "ALL";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>(() =>
    (initialLines ?? []).map((l, i) => {
      const product = l.productId ? products.find((p) => p.id === l.productId) : null;
      return {
        key: `init-${i}-${l.productId || "custom"}`,
        productId: l.productId || "",
        sku: l.sku || product?.sku || "CUSTOM",
        description: l.description,
        metal: l.metal || product?.metal || "GOLD",
        purity: l.purity || product?.purity || "22K",
        netWeight: l.netWeight,
        quantity: l.quantity,
        makingCharge: l.makingCharge,
        stoneCharge: l.stoneCharge,
        wastagePct: l.wastagePct ?? product?.wastagePct ?? 2,
        imageUrl: l.imageUrl ?? product?.imageUrl ?? null,
        stockQty: l.stockQty ?? product?.quantity ?? 999,
      };
    })
  );
  const seedRate =
    initialLines?.[0]?.metalRate ??
    defaultMetalRate ??
    0;
  const [metalRate, setMetalRate] = useState(String(seedRate || ""));
  const [discount, setDiscount] = useState(String(initialDiscount || 0));
  const [taxPct, setTaxPct] = useState(String(initialTaxPct || 3));

  const rate = Number(metalRate) || 0;
  const discountAmt = Number(discount) || 0;
  const taxPercent = Number(taxPct) || 0;

  const scopeHint =
    jewelleryScope === "DIAMOND"
      ? "diamond"
      : jewelleryScope === "GOLD"
        ? "gold"
        : "stock";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? products.slice(0, 12)
      : products.filter((p) => {
          const hay = [
            p.sku,
            p.name,
            p.jewelleryType,
            p.metal,
            p.purity ?? "",
            p.stoneDetails ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
    return list.slice(0, 20);
  }, [products, query]);

  function addProduct(p: SaleProductOption) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key
            ? { ...l, quantity: Math.min(l.quantity + 1, Math.max(1, p.quantity)) }
            : l
        );
      }
      return [
        ...prev,
        {
          key: `${p.id}-${Date.now()}`,
          productId: p.id,
          sku: p.sku,
          description: p.name,
          metal: p.metal || "GOLD",
          purity: p.purity || "22K",
          netWeight: p.netWeight || 0,
          quantity: 1,
          makingCharge: p.makingCharge || 0,
          stoneCharge: 0,
          wastagePct: p.wastagePct ?? 2,
          imageUrl: p.imageUrl,
          stockQty: p.quantity,
        },
      ];
    });
    setQuery("");
    setOpen(false);
    setScanMessage(`Added ${p.sku}`);
    window.setTimeout(() => setScanMessage(null), 1500);
  }

  function tryScanAdd(raw: string) {
    const code = raw.trim();
    if (!code) return false;
    const exact = products.find((p) => p.sku.toLowerCase() === code.toLowerCase());
    if (exact) {
      addProduct(exact);
      return true;
    }
    const q = code.toLowerCase();
    const matches = products.filter((p) => {
      const hay = [p.sku, p.name, p.jewelleryType, p.metal, p.purity ?? "", p.stoneDetails ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    if (matches.length === 1) {
      addProduct(matches[0]);
      return true;
    }
    if (matches.length === 0) {
      setScanMessage(`No stock for “${code}”`);
      window.setTimeout(() => setScanMessage(null), 2500);
    }
    return false;
  }

  function addCustomLine() {
    setLines((prev) => [
      ...prev,
      {
        key: `custom-${Date.now()}`,
        productId: "",
        sku: "CUSTOM",
        description: query.trim() || "Custom jewellery item",
        metal: "GOLD",
        purity: "22K",
        netWeight: 0,
        quantity: 1,
        makingCharge: 0,
        stoneCharge: 0,
        wastagePct: 2,
        imageUrl: null,
        stockQty: 999,
      },
    ]);
    setQuery("");
    setOpen(false);
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const lineTotals = lines.map((l) => {
    const unit = calcJewelleryAmount({
      netWeight: l.netWeight,
      metalRate: rate,
      makingCharge: l.makingCharge,
      stoneCharge: l.stoneCharge,
      wastagePct: l.wastagePct,
    });
    return unit * l.quantity;
  });
  const subtotal = lineTotals.reduce((s, n) => s + n, 0);
  const makingTotal = lines.reduce((s, l) => s + l.makingCharge * l.quantity, 0);
  const taxable = Math.max(0, subtotal - discountAmt);
  const taxAmount = (taxable * taxPercent) / 100;
  const grandTotal = taxable + taxAmount;

  const itemsPayload = lines.map((l, i) => ({
    productId: l.productId || null,
    description: l.description,
    metal: l.metal,
    purity: l.purity,
    netWeight: l.netWeight,
    quantity: l.quantity,
    metalRate: rate,
    makingCharge: l.makingCharge,
    stoneCharge: l.stoneCharge,
    wastagePct: l.wastagePct,
    amount: lineTotals[i],
  }));

  return (
    <div className="md:col-span-2 space-y-4">
      <input type="hidden" name="itemsJson" value={JSON.stringify(itemsPayload)} />
      <input type="hidden" name="metalRate" value={metalRate} />
      <input type="hidden" name="discount" value={discount} />
      <input type="hidden" name="taxPct" value={taxPct} />

      <div className="relative">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">
            Search or scan barcode (SKU)
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (tryScanAdd(query)) return;
                setOpen(true);
              }}
              placeholder={`Scan barcode or type ${scopeHint} SKU / name…`}
              className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-9 pr-10 text-sm outline-none ring-[var(--gold)]/30 placeholder:text-stone-400 focus:ring-2"
              autoComplete="off"
              autoFocus
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted)] hover:bg-stone-100"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </label>
        {scanMessage ? (
          <p
            className={`mt-1.5 text-xs ${
              scanMessage.startsWith("Added") ? "text-emerald-700" : "text-amber-800"
            }`}
          >
            {scanMessage}
          </p>
        ) : null}

        {open ? (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-[var(--border)] bg-white shadow-lg">
            <button
              type="button"
              className="flex w-full items-center gap-2 border-b border-[var(--border)] px-3 py-2.5 text-left text-sm text-[var(--muted)] hover:bg-stone-50"
              onClick={addCustomLine}
            >
              <Plus className="h-4 w-4" />
              Add custom / loose item
              {query.trim() ? ` “${query.trim()}”` : ""}
            </button>
            {results.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[var(--muted)]">
                No matching {scopeHint} items.
              </p>
            ) : (
              results.map((p) => {
                const already = lines.some((l) => l.productId === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 text-left last:border-0 hover:bg-stone-50"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-stone-400">
                          No img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--ink)]">
                        {p.name}
                        {already ? (
                          <span className="ml-2 text-xs font-normal text-[var(--gold-deep)]">
                            (in list — +1)
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {p.sku} · {p.jewelleryType} · {p.metal}
                        {p.purity ? ` ${p.purity}` : ""} · {p.netWeight}g · Qty {p.quantity}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 shrink-0 text-[var(--gold-deep)]" />
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="font-[family-name:var(--font-display)] text-lg">Sale items</h3>
          <span className="text-xs text-[var(--muted)]">
            {lines.length} item{lines.length === 1 ? "" : "s"}
          </span>
        </div>

        {lines.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            Search and add items to the list before completing the sale.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {lines.map((l, idx) => (
              <li key={l.key} className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {l.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-stone-400">
                        Custom
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      value={l.description}
                      onChange={(e) => updateLine(l.key, { description: e.target.value })}
                      className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                    />
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {l.sku}
                      {l.productId ? ` · stock ${l.stockQty}` : " · loose item"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(l.key)}
                    className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">Metal</span>
                    <select
                      value={l.metal}
                      onChange={(e) => updateLine(l.key, { metal: e.target.value })}
                      className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="GOLD">Gold</option>
                      <option value="SILVER">Silver</option>
                      <option value="PLATINUM">Platinum</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">Purity</span>
                    <input
                      value={l.purity}
                      onChange={(e) => updateLine(l.key, { purity: e.target.value })}
                      className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">Weight g</span>
                    <input
                      type="number"
                      step="0.001"
                      value={l.netWeight}
                      onChange={(e) =>
                        updateLine(l.key, { netWeight: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">Qty</span>
                    <input
                      type="number"
                      min={1}
                      max={l.stockQty || undefined}
                      value={l.quantity}
                      onChange={(e) =>
                        updateLine(l.key, {
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">Making ({baseCurrency})</span>
                    <input
                      type="number"
                      step="0.01"
                      value={l.makingCharge}
                      onChange={(e) =>
                        updateLine(l.key, { makingCharge: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--muted)]">Stone ({baseCurrency})</span>
                    <input
                      type="number"
                      step="0.01"
                      value={l.stoneCharge}
                      onChange={(e) =>
                        updateLine(l.key, { stoneCharge: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted)]">Line total</span>
                  <span className="font-medium text-[var(--gold-deep)]">
                    {formatMoney(lineTotals[idx], baseCurrency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">
            Metal Rate /g ({baseCurrency})
          </span>
          <input
            type="number"
            step="0.01"
            value={metalRate}
            onChange={(e) => setMetalRate(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">
            Discount ({baseCurrency})
          </span>
          <input
            type="number"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">Tax %</span>
          <input
            type="number"
            step="0.1"
            value={taxPct}
            onChange={(e) => setTaxPct(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
          />
        </label>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-[var(--muted)]">Subtotal ({baseCurrency})</span>
          <span>{formatMoney(subtotal, baseCurrency)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-[var(--muted)]">Making (all lines)</span>
          <span>{formatMoney(makingTotal, baseCurrency)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-[var(--muted)]">Discount</span>
          <span>− {formatMoney(discountAmt, baseCurrency)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-[var(--muted)]">Tax</span>
          <span>{formatMoney(taxAmount, baseCurrency)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-[var(--border)] pt-2 text-base font-semibold">
          <span>Grand total ({baseCurrency})</span>
          <span className="text-[var(--gold-deep)]">
            {formatMoney(grandTotal, baseCurrency)}
          </span>
        </div>
      </div>

      <SalePayments
        dueAmount={grandTotal}
        baseCurrency={baseCurrency}
        initialPayments={initialPayments}
      />
    </div>
  );
}
