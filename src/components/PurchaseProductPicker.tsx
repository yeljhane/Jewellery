"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

export type PurchaseProductOption = {
  id: string;
  sku: string;
  name: string;
  metal: string;
  purity: string | null;
  quantity: number;
  sellingPrice: number;
  jewelleryType: string;
  imageUrl: string | null;
};

export function PurchaseProductPicker({
  products,
  defaultProductId = "",
  jewelleryType = "GOLD",
}: {
  products: PurchaseProductOption[];
  defaultProductId?: string;
  jewelleryType?: "GOLD" | "DIAMOND";
}) {
  const selected = products.find((p) => p.id === defaultProductId) ?? null;
  const [productId, setProductId] = useState(defaultProductId);
  const [query, setQuery] = useState(
    selected ? `${selected.sku} — ${selected.name}` : ""
  );
  const [open, setOpen] = useState(false);

  const label = jewelleryType === "DIAMOND" ? "Diamond" : "Gold";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || productId) return products.slice(0, 12);
    return products
      .filter((p) =>
        `${p.sku} ${p.name} ${p.metal} ${p.purity ?? ""} ${p.jewelleryType}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 20);
  }, [products, query, productId]);

  const current = products.find((p) => p.id === productId) ?? null;

  function pick(p: PurchaseProductOption) {
    setProductId(p.id);
    setQuery(`${p.sku} — ${p.name}`);
    setOpen(false);
  }

  function clear() {
    setProductId("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative md:col-span-2 space-y-1.5">
      <input type="hidden" name="productId" value={productId} />
      <span className="text-xs font-medium text-[var(--muted)]">
        {label} finished stock item
      </span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setProductId("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${label.toLowerCase()} stock SKU or name…`}
          required
          autoComplete="off"
          className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-9 pr-10 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
        />
        {query ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted)] hover:bg-stone-100"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {current ? (
        <p className="text-xs text-[var(--muted)]">
          Current stock qty: <strong>{current.quantity}</strong>
          {current.purity ? ` · ${current.metal} ${current.purity}` : ` · ${current.metal}`}
          {" · "}Purchased qty will be added automatically on receive.
        </p>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Only {label.toLowerCase()} jewellery items are listed for this purchase type.
        </p>
      )}

      {open && !productId ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[var(--border)] bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[var(--muted)]">
              No matching {label.toLowerCase()} stock.
            </p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className="flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 text-left last:border-0 hover:bg-stone-50"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {p.sku} · Qty {p.quantity}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
