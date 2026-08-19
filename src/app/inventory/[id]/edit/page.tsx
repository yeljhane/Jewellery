import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProduct, updateProduct } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { JEWELLERY_TYPES } from "@/lib/txn-types";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ImagePreviewFields } from "@/components/ImagePreviewFields";
import { DeleteButton } from "@/components/ConfirmForm";
import { BarcodeSvg } from "@/components/BarcodeSvg";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();

  return (
    <div>
      <PageHeader
        title={`Edit ${product.name}`}
        description={`SKU ${product.sku} · update stock details, price, and photo.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/inventory/${product.id}/label`}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
            >
              Print barcode
            </Link>
            <DeleteButton
              action={deleteProduct}
              id={product.id}
              message={`Delete or archive “${product.name}”? Items used on sales will be archived instead of removed.`}
            />
            <Link href="/inventory" className="text-sm text-[var(--gold-deep)] hover:underline">
              Back to stock
            </Link>
          </div>
        }
      />
      <Card title="Barcode (CODE128 · SKU)" className="mb-6 no-print">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BarcodeSvg sku={product.sku} height={52} />
          <Link
            href={`/inventory/${product.id}/label`}
            className="rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
          >
            Print label
          </Link>
        </div>
      </Card>
      <Card>
        <ActionForm
          action={updateProduct}
          successTitle="Inventory updated"
          successMessage="The inventory item was updated successfully."
          className="grid gap-4 md:grid-cols-2"
          encType="multipart/form-data"
        >
          <input type="hidden" name="id" value={product.id} />
          <Input label="SKU" name="sku" defaultValue={product.sku} required />
          <Input label="Name" name="name" defaultValue={product.name} required />
          <Select
            label="Jewellery Category"
            name="jewelleryType"
            defaultValue={product.jewelleryType || "GOLD"}
            required
          >
            {JEWELLERY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select label="Item Type / Style" name="categoryId" defaultValue={product.categoryId ?? ""}>
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Metal" name="metal" defaultValue={product.metal}>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="PLATINUM">Platinum</option>
            <option value="FASHION">Fashion</option>
          </Select>
          <Input label="Purity" name="purity" defaultValue={product.purity ?? ""} />
          <Input
            label="Gross Weight (g)"
            name="grossWeight"
            type="number"
            step="0.001"
            defaultValue={product.grossWeight}
          />
          <Input
            label="Net Weight (g)"
            name="netWeight"
            type="number"
            step="0.001"
            defaultValue={product.netWeight}
          />
          <Input
            label="Stone Weight"
            name="stoneWeight"
            type="number"
            step="0.001"
            defaultValue={product.stoneWeight}
          />
          <Input
            label="Stone Details"
            name="stoneDetails"
            defaultValue={product.stoneDetails ?? ""}
          />
          <Input
            label="Making Charge"
            name="makingCharge"
            type="number"
            step="0.01"
            defaultValue={product.makingCharge}
          />
          <Input
            label="Wastage %"
            name="wastagePct"
            type="number"
            step="0.1"
            defaultValue={product.wastagePct}
          />
          <Input
            label="Cost Price"
            name="costPrice"
            type="number"
            step="0.01"
            defaultValue={product.costPrice}
          />
          <Input
            label="Selling Price"
            name="sellingPrice"
            type="number"
            step="0.01"
            defaultValue={product.sellingPrice}
          />
          <Input
            label="Quantity"
            name="quantity"
            type="number"
            defaultValue={product.quantity}
          />
          <Select label="Status" name="status" defaultValue={product.status}>
            <option value="IN_STOCK">In stock</option>
            <option value="RESERVED">Reserved</option>
            <option value="SOLD">Sold</option>
            <option value="IN_PRODUCTION">In production</option>
          </Select>
          <ImagePreviewFields currentImageUrl={product.imageUrl} />
          <div className="md:col-span-2">
            <Textarea label="Notes" name="notes" rows={3} defaultValue={product.notes ?? ""} />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button type="submit">Save Changes</Button>
            <Link
              href="/inventory"
              className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </Link>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
