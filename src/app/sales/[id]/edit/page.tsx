import Link from "next/link";
import { notFound } from "next/navigation";
import { updateSale } from "@/lib/actions";
import { getLatestMetalRates } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { SaleFormFields } from "@/components/SaleFormFields";

export const dynamic = "force-dynamic";

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sale, customers, products, employees, rates, settings] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      orderBy: [{ jewelleryType: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getLatestMetalRates(),
    prisma.shopSettings.findFirst(),
  ]);
  if (!sale) notFound();

  const defaultRate =
    sale.items[0]?.metalRate ||
    rates["GOLD-22K"] ||
    rates["GOLD-18K"] ||
    0;
  const baseCurrency = settings?.currency ?? "INR";
  const defaultTaxPct = settings?.taxPct ?? 3;

  const soldIds = new Set(
    sale.items.map((i) => i.productId).filter(Boolean) as string[]
  );
  const productOptions = products
    .filter((p) => p.status === "IN_STOCK" || soldIds.has(p.id) || p.quantity > 0)
    .map((p) => ({
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
      quantity: soldIds.has(p.id)
        ? p.quantity + (sale.items.find((i) => i.productId === p.id)?.quantity || 0)
        : p.quantity,
      imageUrl: p.imageUrl,
      wastagePct: p.wastagePct,
    }));

  const taxableBase = Math.max(0, sale.subtotal - sale.discount);
  const initialTaxPct =
    taxableBase > 0
      ? Math.round((sale.taxAmount / taxableBase) * 1000) / 10
      : defaultTaxPct;

  return (
    <div>
      <PageHeader
        title={`Edit ${sale.invoiceNumber}`}
        description="Update items, payments, and customer details. Stock and accounting will be recalculated."
        actions={
          <Link href={`/sales/${sale.id}`} className="text-sm text-[var(--gold-deep)] hover:underline">
            Cancel
          </Link>
        }
      />
      <Card>
        <SaleFormFields
          action={updateSale}
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
          submitLabel="Save Changes"
          defaults={{
            id: sale.id,
            txnType: sale.txnType,
            customerId: sale.customerId ?? "",
            customerName: sale.customerName || sale.customer?.name || "",
            employeeId: sale.employeeId ?? "",
            notes: sale.notes ?? "",
            initialDiscount: sale.discount,
            initialTaxPct,
            initialLines: sale.items.map((i) => ({
              productId: i.productId,
              description: i.description,
              metal: i.metal,
              purity: i.purity,
              netWeight: i.netWeight,
              quantity: i.quantity,
              makingCharge: i.makingCharge,
              stoneCharge: i.stoneCharge,
              metalRate: i.metalRate,
              imageUrl: i.product?.imageUrl ?? null,
              sku: i.product?.sku,
              stockQty: i.product ? i.product.quantity + i.quantity : 999,
            })),
            initialPayments: sale.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              currency: p.currency,
              foreignAmount: p.foreignAmount,
              exchangeRate: p.exchangeRate,
              reference: p.reference,
            })),
          }}
        />
      </Card>
    </div>
  );
}
