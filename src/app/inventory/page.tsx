import Image from "next/image";
import Link from "next/link";
import { deleteProduct } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { getShopCurrency } from "@/lib/data";
import { isDiamondProduct, stockSortRank } from "@/lib/products";
import { formatCurrency, formatWeight } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { DeleteButton } from "@/components/ConfirmForm";
import { Gem, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q, sort } = await searchParams;
  const query = (q ?? "").trim();
  const sortMode = sort === "gold" || sort === "diamonds" || sort === "all" ? sort : "diamonds";

  const [products, currency] = await Promise.all([
    prisma.product.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query } },
              { sku: { contains: query } },
              { metal: { contains: query } },
              { purity: { contains: query } },
              { stoneDetails: { contains: query } },
              { notes: { contains: query } },
              { category: { name: { contains: query } } },
            ],
          }
        : undefined,
      include: { category: true },
    }),
    getShopCurrency(),
  ]);
  const money = (n: number) => formatCurrency(n, currency);

  const sorted = [...products].sort((a, b) => {
    const rankDiff = stockSortRank(a) - stockSortRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });

  const display =
    sortMode === "diamonds"
      ? sorted.filter((p) => isDiamondProduct(p))
      : sortMode === "gold"
        ? sorted.filter(
            (p) => p.jewelleryType === "GOLD" || (!isDiamondProduct(p) && p.metal === "GOLD")
          )
        : sorted;

  const diamondCount = products.filter(isDiamondProduct).length;
  const goldCount = products.filter(
    (p) => p.jewelleryType === "GOLD" || (!isDiamondProduct(p) && p.metal === "GOLD")
  ).length;

  return (
    <div>
      <PageHeader
        title="Finished Stock"
        description={`Search stock, browse diamonds then gold · ${currency}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/inventory/serials"
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              Serials
            </Link>
            <Link
              href={
                query
                  ? `/inventory/labels?q=${encodeURIComponent(query)}`
                  : "/inventory/labels"
              }
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              Print barcodes
            </Link>
            <Link
              href="/inventory/new"
              className="rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
            >
              Add Product
            </Link>
          </div>
        }
      />

      <form className="mb-6 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[220px] flex-1 space-y-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">Search stock</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              name="q"
              defaultValue={query}
              placeholder="SKU, name, metal, diamond, purity…"
              className="w-full rounded-lg border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
            />
          </div>
        </label>
        <input type="hidden" name="sort" value={sortMode} />
        <button
          type="submit"
          className="rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
        >
          Search
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { value: "diamonds", label: `Diamonds (${diamondCount})` },
          { value: "gold", label: `Gold (${goldCount})` },
          { value: "all", label: `All (${products.length})` },
        ].map((f) => {
          const active = sortMode === f.value;
          const href = query
            ? `/inventory?q=${encodeURIComponent(query)}&sort=${f.value}`
            : `/inventory?sort=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                active
                  ? "bg-[var(--gold-deep)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-stone-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {display.length === 0 ? (
        <EmptyState
          title={query ? "No matching stock" : "No products yet"}
          description={
            query
              ? `Nothing found for “${query}”.`
              : "Add finished jewellery with photos to your stock."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {display.map((p) => {
            const diamond = isDiamondProduct(p);
            return (
              <article
                key={p.id}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
              >
                <div className="relative aspect-[4/3] bg-[var(--ink)]/5">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 33vw"
                      unoptimized={p.imageUrl.endsWith(".svg")}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--muted)]">
                      <Gem className="h-10 w-10 opacity-40" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1">
                    <Badge tone={diamond ? "info" : "gold"}>
                      {diamond ? "Diamond Jewellery" : "Gold Jewellery"}
                    </Badge>
                    <Badge tone="neutral">
                      {p.metal}
                      {p.purity ? ` ${p.purity}` : ""}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                        {p.name}
                      </h2>
                      <p className="font-mono text-xs text-[var(--muted)]">{p.sku}</p>
                    </div>
                    <Badge
                      tone={
                        p.status === "IN_STOCK"
                          ? "success"
                          : p.status === "SOLD"
                            ? "neutral"
                            : "info"
                      }
                    >
                      {p.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {p.stoneDetails ? (
                    <p className="text-sm text-[var(--muted)]">{p.stoneDetails}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span>{formatWeight(p.netWeight)}</span>
                    <span className="text-[var(--muted)]">·</span>
                    <span>Qty {p.quantity}</span>
                    <span className="text-[var(--muted)]">·</span>
                    <span className="font-medium text-[var(--gold-deep)]">
                      {money(p.sellingPrice)}
                    </span>
                  </div>
                  {p.category ? (
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                      {p.category.name}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      href={`/inventory/${p.id}/edit`}
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/inventory/${p.id}/label`}
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
                    >
                      Barcode
                    </Link>
                    <DeleteButton
                      action={deleteProduct}
                      id={p.id}
                      label="Delete"
                      message={`Delete or archive “${p.name}”?`}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {display.length > 0 ? (
        <p className="mt-4 text-xs text-[var(--muted)]">
          Showing {display.length} item{display.length === 1 ? "" : "s"}
          {query ? ` for “${query}”` : ""} · sorted diamonds → gold → others
        </p>
      ) : null}
    </div>
  );
}
