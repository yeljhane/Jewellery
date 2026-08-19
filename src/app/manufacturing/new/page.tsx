import Link from "next/link";
import { createManufacturingJob } from "@/lib/actions";
import { ActionForm } from "@/components/ActionForm";
import { prisma } from "@/lib/prisma";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const [karigars, materials, products, customers] = await Promise.all([
    prisma.karigar.findMany({ orderBy: { name: "asc" } }),
    prisma.rawMaterial.findMany({
      where: { type: "METAL", weightGrams: { gt: 0 } },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({ orderBy: { name: "asc" }, take: 50 }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="New Job Card"
        description="Issue metal to a karigar for casting, setting, polishing, or a custom client order."
        actions={
          <Link href="/manufacturing" className="text-sm text-[var(--gold-deep)] hover:underline">
            Back
          </Link>
        }
      />
      <Card>
        <ActionForm action={createManufacturingJob} successMessage="The manufacturing job was added successfully." className="grid gap-4 md:grid-cols-2">
          <Input label="Design Name" name="designName" placeholder="Custom Halo Ring" required />
          <Select label="Karigar" name="karigarId" defaultValue="">
            <option value="">Unassigned</option>
            {karigars.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.specialty ? ` — ${k.specialty}` : ""}
              </option>
            ))}
          </Select>
          <Select label="Custom order for customer" name="customerId" defaultValue="">
            <option value="">Stock / no client</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.vipTier !== "STANDARD" ? ` (${c.vipTier})` : ""}
              </option>
            ))}
          </Select>
          <Select label="Custom order?" name="isCustomOrder" defaultValue="0">
            <option value="0">No — workshop stock</option>
            <option value="1">Yes — client custom order</option>
          </Select>
          <Input label="Client deposit" name="depositAmount" type="number" step="0.01" />
          <Select label="Metal" name="metal" defaultValue="GOLD">
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="PLATINUM">Platinum</option>
          </Select>
          <Input label="Purity" name="purity" placeholder="18K" />
          <Select label="Issue From Material" name="rawMaterialId" defaultValue="">
            <option value="">Don&apos;t issue yet</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.weightGrams.toFixed(2)} g available)
              </option>
            ))}
          </Select>
          <Input label="Issued Weight (g)" name="issuedWeight" type="number" step="0.001" />
          <Input label="Labour Cost" name="labourCost" type="number" step="0.01" />
          <Input label="Due Date" name="dueDate" type="date" />
          <Select label="Link Product (optional)" name="productId" defaultValue="">
            <option value="">None</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <Textarea label="Notes" name="notes" rows={3} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Create Job Card</Button>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
