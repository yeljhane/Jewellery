import Link from "next/link";
import { createPurchaseOrder } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { PurchaseFormFields } from "@/components/PurchaseFormFields";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      orderBy: [{ name: "asc" }],
    }),
  ]);

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
        title="New Purchase Order"
        description="Buy raw metal/materials or finished stock. Finished stock qty is added to inventory when received."
        actions={
          <Link href="/purchases" className="text-sm text-[var(--gold-deep)] hover:underline">
            Back
          </Link>
        }
      />
      <Card>
        {suppliers.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Add a supplier first.{" "}
            <Link href="/suppliers" className="text-[var(--gold-deep)] underline">
              Suppliers
            </Link>
          </p>
        ) : productOptions.length === 0 ? (
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <p>
              For finished stock purchases, add products first. Raw material purchases still work
              without stock items.
            </p>
            <PurchaseFormFields
              suppliers={suppliers}
              products={[]}
              action={createPurchaseOrder}
              defaults={{ txnType: "GOLD_PURCHASE", status: "ORDERED" }}
            />
            <p>
              Or{" "}
              <Link href="/inventory/new" className="text-[var(--gold-deep)] underline">
                add a finished product
              </Link>{" "}
              then purchase into it.
            </p>
          </div>
        ) : (
          <PurchaseFormFields
            suppliers={suppliers}
            products={productOptions}
            action={createPurchaseOrder}
            defaults={{ txnType: "FINISHED_GOLD_PURCHASE", status: "RECEIVED" }}
            submitLabel="Save Purchase"
          />
        )}
      </Card>
    </div>
  );
}
