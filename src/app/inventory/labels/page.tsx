import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { BarcodeLabelSheet } from "@/components/BarcodeLabelSheet";

export const dynamic = "force-dynamic";

export default async function InventoryLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; q?: string }>;
}) {
  const { ids, q } = await searchParams;
  const idList = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const query = (q ?? "").trim();

  const products = await prisma.product.findMany({
    where: idList.length
      ? { id: { in: idList } }
      : query
        ? {
            OR: [
              { name: { contains: query } },
              { sku: { contains: query } },
              { metal: { contains: query } },
            ],
          }
        : { status: "IN_STOCK", quantity: { gt: 0 } },
    orderBy: [{ sku: "asc" }],
    take: idList.length ? undefined : 200,
  });

  const labels = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    metal: p.metal,
    purity: p.purity,
    netWeight: p.netWeight,
    jewelleryType: p.jewelleryType,
  }));

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Print barcode labels"
          description={
            idList.length
              ? `${labels.length} selected label${labels.length === 1 ? "" : "s"}`
              : query
                ? `${labels.length} match${labels.length === 1 ? "" : "es"} for “${query}”`
                : `In-stock items (up to 200) · CODE128 from SKU`
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PrintButton label="Print labels" />
              <Link href="/inventory" className="text-sm text-[var(--gold-deep)] hover:underline">
                Back to stock
              </Link>
            </div>
          }
        />
        {labels.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No products to print.</p>
        ) : null}
      </div>
      {labels.length > 0 ? <BarcodeLabelSheet products={labels} /> : null}
    </div>
  );
}
