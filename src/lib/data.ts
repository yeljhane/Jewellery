import { prisma } from "./prisma";
import { generateNumber } from "./utils";

export async function nextInvoiceNumber() {
  const count = await prisma.sale.count();
  return generateNumber("INV", count + 1);
}

export async function nextPoNumber() {
  const count = await prisma.purchaseOrder.count();
  return generateNumber("PO", count + 1);
}

export async function nextJobNumber() {
  const count = await prisma.manufacturingJob.count();
  return generateNumber("JOB", count + 1);
}

export async function nextSerialNumber() {
  const count = await prisma.inventoryItem.count();
  return `SN-${String(count + 1).padStart(6, "0")}`;
}

export async function nextRepairNumber() {
  const count = await prisma.repairOrder.count();
  return generateNumber("RPR", count + 1);
}

export async function nextAppraisalNumber() {
  const count = await prisma.appraisal.count();
  return generateNumber("APR", count + 1);
}

export async function nextServiceCaseNumber() {
  const count = await prisma.customerServiceCase.count();
  return generateNumber("CASE", count + 1);
}

export async function nextVatRefundNumber() {
  const count = await prisma.touristVatRefund.count();
  return generateNumber("VAT", count + 1);
}

export async function nextSku(prefix = "JW") {
  const count = await prisma.product.count();
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

export async function getShopCurrency() {
  const settings = await prisma.shopSettings.findFirst({
    select: { currency: true },
  });
  return settings?.currency || "AZN";
}

export async function getLatestMetalRates() {
  const metals = ["GOLD", "SILVER", "PLATINUM"] as const;
  const purities = {
    GOLD: ["24K", "22K", "18K"],
    SILVER: ["999", "925"],
    PLATINUM: ["950"],
  };

  const rates: Record<string, number> = {};
  for (const metal of metals) {
    for (const purity of purities[metal]) {
      const rate = await prisma.metalRate.findFirst({
        where: { metal, purity },
        orderBy: { effectiveFrom: "desc" },
      });
      if (rate) rates[`${metal}-${purity}`] = rate.ratePerGram;
    }
  }
  return rates;
}

export async function getDashboardStats() {
  const [
    productCount,
    rawMaterialAgg,
    todaySales,
    openJobs,
    customerCount,
    recentSales,
    lowStock,
    metalRates,
  ] = await Promise.all([
    prisma.product.count({ where: { status: "IN_STOCK", quantity: { gt: 0 } } }),
    prisma.rawMaterial.aggregate({ _sum: { weightGrams: true } }),
    prisma.sale.aggregate({
      where: {
        status: "COMPLETED",
        saleDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.manufacturingJob.count({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    prisma.customer.count(),
    prisma.sale.findMany({
      where: { status: "COMPLETED" },
      include: { customer: true },
      orderBy: { saleDate: "desc" },
      take: 5,
    }),
    prisma.product.findMany({
      where: { quantity: { lte: 2 }, status: "IN_STOCK" },
      take: 5,
      orderBy: { quantity: "asc" },
    }),
    getLatestMetalRates(),
  ]);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthSales = await prisma.sale.aggregate({
    where: { status: "COMPLETED", saleDate: { gte: monthStart } },
    _sum: { totalAmount: true },
  });

  return {
    productCount,
    rawWeight: rawMaterialAgg._sum.weightGrams ?? 0,
    todayRevenue: todaySales._sum.totalAmount ?? 0,
    todaySaleCount: todaySales._count,
    openJobs,
    customerCount,
    monthRevenue: monthSales._sum.totalAmount ?? 0,
    recentSales,
    lowStock,
    metalRates,
  };
}
