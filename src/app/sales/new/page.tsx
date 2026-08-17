import Link from "next/link";
import { createSale } from "@/lib/actions";
import { getLatestMetalRates } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { SaleFormFields } from "@/components/SaleFormFields";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const [customers, products, employees, rates, settings] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { status: "IN_STOCK", quantity: { gt: 0 } },
      orderBy: [{ jewelleryType: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getLatestMetalRates(),
    prisma.shopSettings.findFirst(),
  ]);

  const defaultRate = rates["GOLD-22K"] ?? rates["GOLD-18K"] ?? 0;
  const baseCurrency = settings?.currency ?? "INR";
  const defaultTaxPct = settings?.taxPct ?? 3;

  const productOptions = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    jewelleryType: p.jewelleryType || "",
    metal: p.metal,
    purity: p.purity,
    netWeight: p.netWeight,
    makingCharge: p.makingCharge,
    stoneDetails: p.stoneDetails,
    sellingPrice: p.sellingPrice,
    quantity: p.quantity,
    imageUrl: p.imageUrl,
    wastagePct: p.wastagePct,
  }));

  return (
    <div>
      <PageHeader
        title="New sale / return"
        description="Full sale form including returns. For quick counter billing, use POS."
        actions={
          <div className="flex gap-3 text-sm">
            <Link href="/pos" className="text-[var(--gold-deep)] hover:underline">
              Open POS
            </Link>
            <Link href="/sales" className="text-[var(--muted)] hover:underline">
              Back to sales
            </Link>
          </div>
        }
      />
      <Card>
        <SaleFormFields
          mode="full"
          action={createSale}
          customers={customers.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            vipTier: c.vipTier,
          }))}
          employees={employees.map((e) => ({ id: e.id, name: e.name }))}
          products={productOptions}
          defaultMetalRate={defaultRate}
          baseCurrency={baseCurrency}
          defaultTaxPct={defaultTaxPct}
          defaults={{ txnType: "RETAIL_SALE", initialTaxPct: defaultTaxPct }}
          submitLabel="Complete Sale"
        />
      </Card>
    </div>
  );
}
