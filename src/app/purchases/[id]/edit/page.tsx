import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePurchaseOrder } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { PurchaseFormFields } from "@/components/PurchaseFormFields";

export const dynamic = "force-dynamic";

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [po, suppliers, products] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: [{ name: "asc" }] }),
  ]);
  if (!po) notFound();
  const item = po.items[0];

  const productOptions = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    metal: p.metal,
    purity: p.purity,
    quantity: p.quantity,
    sellingPrice: p.sellingPrice,
    jewelleryType: p.jewelleryType || "",
    imageUrl: p.imageUrl,
  }));

  return (
    <div>
      <PageHeader
        title={`Edit ${po.poNumber}`}
        description={
          po.status === "RECEIVED"
            ? "Editing a received PO will reverse stock & journal, then re-apply if still marked received."
            : "Update purchase details before or after ordering."
        }
        actions={
          <Link href={`/purchases/${po.id}`} className="text-sm text-[var(--gold-deep)] hover:underline">
            Cancel
          </Link>
        }
      />
      <Card>
        <PurchaseFormFields
          suppliers={suppliers}
          products={productOptions}
          action={updatePurchaseOrder}
          submitLabel="Save Changes"
          defaults={{
            id: po.id,
            txnType: po.txnType,
            supplierId: po.supplierId,
            status: po.status,
            description: item?.description ?? "",
            metal: item?.metal ?? "GOLD",
            purity: item?.purity ?? "",
            weightGrams: item?.weightGrams ?? 0,
            quantity: item?.quantity ?? 1,
            rate: item?.rate ?? 0,
            notes: po.notes ?? "",
            productId: item?.productId ?? null,
          }}
        />
      </Card>
    </div>
  );
}
