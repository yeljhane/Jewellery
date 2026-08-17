import Link from "next/link";
import { createRawMaterial } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewMaterialPage() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Add Raw Material"
        description="Record bullion, stones, or findings into the vault."
        actions={
          <Link href="/materials" className="text-sm text-[var(--gold-deep)] hover:underline">
            Back
          </Link>
        }
      />
      <Card>
        <form action={createRawMaterial} className="grid gap-4 md:grid-cols-2">
          <Input label="Name" name="name" placeholder="22K Gold Bar" required />
          <Select label="Type" name="type" defaultValue="METAL">
            <option value="METAL">Metal</option>
            <option value="STONE">Stone</option>
            <option value="FINDING">Finding</option>
            <option value="OTHER">Other</option>
          </Select>
          <Select label="Metal" name="metal" defaultValue="GOLD">
            <option value="">N/A</option>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="PLATINUM">Platinum</option>
          </Select>
          <Input label="Purity" name="purity" placeholder="22K / 925" />
          <Input label="Weight (g)" name="weightGrams" type="number" step="0.001" />
          <Input label="Quantity" name="quantity" type="number" step="0.001" />
          <Select label="Unit" name="unit" defaultValue="g">
            <option value="g">Grams</option>
            <option value="ct">Carats</option>
            <option value="pcs">Pieces</option>
          </Select>
          <Input label="Cost per Unit" name="costPerUnit" type="number" step="0.01" />
          <Select label="Supplier" name="supplierId" defaultValue="">
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input label="Location" name="location" placeholder="Safe A1" />
          <div className="md:col-span-2">
            <Textarea label="Notes" name="notes" rows={3} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Save Material</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
