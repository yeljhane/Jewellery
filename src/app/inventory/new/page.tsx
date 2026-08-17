import Link from "next/link";
import { createProduct } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { nextSku } from "@/lib/data";
import { JEWELLERY_TYPES } from "@/lib/txn-types";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ImagePreviewFields } from "@/components/ImagePreviewFields";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const [categories, sku] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    nextSku(),
  ]);

  return (
    <div>
      <PageHeader
        title="Add Product"
        description="Register a finished piece with photo into inventory."
        actions={
          <Link href="/inventory" className="text-sm text-[var(--gold-deep)] hover:underline">
            Back to stock
          </Link>
        }
      />
      <Card>
        <form action={createProduct} className="grid gap-4 md:grid-cols-2" encType="multipart/form-data">
          <Input label="SKU" name="sku" defaultValue={sku} required />
          <Input label="Name" name="name" placeholder="Temple Necklace Set" required />
          <Select label="Jewellery Category" name="jewelleryType" defaultValue="GOLD" required>
            {JEWELLERY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select label="Item Type / Style" name="categoryId" defaultValue="">
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Metal" name="metal" defaultValue="GOLD">
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="PLATINUM">Platinum</option>
            <option value="FASHION">Fashion</option>
          </Select>
          <Input label="Purity" name="purity" placeholder="22K" />
          <Input label="Gross Weight (g)" name="grossWeight" type="number" step="0.001" />
          <Input label="Net Weight (g)" name="netWeight" type="number" step="0.001" />
          <Input label="Stone Weight" name="stoneWeight" type="number" step="0.001" />
          <Input label="Stone Details" name="stoneDetails" placeholder="1ct diamond VS1" />
          <Input label="Making Charge" name="makingCharge" type="number" step="0.01" />
          <Input label="Wastage %" name="wastagePct" type="number" step="0.1" defaultValue="2" />
          <Input label="Cost Price" name="costPrice" type="number" step="0.01" />
          <Input label="Selling Price" name="sellingPrice" type="number" step="0.01" />
          <Input label="Quantity" name="quantity" type="number" defaultValue="1" />
          <ImagePreviewFields />
          <div className="md:col-span-2">
            <Textarea label="Notes" name="notes" rows={3} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Save Product</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
