import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { BarcodeLabelSheet } from "@/components/BarcodeLabelSheet";

export const dynamic = "force-dynamic";

export default async function ProductLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) notFound();

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Print barcode"
          description={`CODE128 label for ${product.sku}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PrintButton label="Print label" />
              <Link
                href={`/inventory/${product.id}/edit`}
                className="text-sm text-[var(--gold-deep)] hover:underline"
              >
                Back to product
              </Link>
            </div>
          }
        />
      </div>
      <BarcodeLabelSheet
        products={[
          {
            id: product.id,
            sku: product.sku,
            name: product.name,
            metal: product.metal,
            purity: product.purity,
            netWeight: product.netWeight,
            jewelleryType: product.jewelleryType,
          },
        ]}
      />
    </div>
  );
}
