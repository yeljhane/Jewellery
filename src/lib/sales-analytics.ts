import { prisma } from "@/lib/prisma";
import { isSaleReturn } from "@/lib/txn-types";
import { isDiamondProduct } from "@/lib/product-helpers";

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function collectionLabel(product: {
  jewelleryType?: string | null;
  name: string;
  stoneDetails?: string | null;
  category?: { name: string } | null;
}) {
  if (product.category?.name) return product.category.name;
  if (isDiamondProduct(product)) return "Diamond";
  if (product.jewelleryType === "GOLD" || !product.jewelleryType) return "Gold";
  return product.jewelleryType;
}

export async function getSalesAnalytics(from: Date, to: Date) {
  const now = new Date();

  const sales = await prisma.sale.findMany({
    where: {
      saleDate: { gte: from, lte: to },
      status: { in: ["COMPLETED", "RETURNED"] },
    },
    include: {
      customer: true,
      employee: true,
      items: {
        include: {
          product: { include: { category: true } },
        },
      },
    },
    orderBy: { saleDate: "desc" },
  });

  const completed = sales.filter((s) => !isSaleReturn(s.txnType) && s.status === "COMPLETED");
  const returns = sales.filter((s) => isSaleReturn(s.txnType) || s.status === "RETURNED");

  const grossRevenue = completed.reduce((s, x) => s + x.totalAmount, 0);
  const returnRevenue = returns.reduce((s, x) => s + x.totalAmount, 0);
  const netRevenue = grossRevenue - returnRevenue;
  const invoiceCount = completed.length;

  // —— Collections ——
  const collectionMap = new Map<
    string,
    { name: string; revenue: number; qty: number; invoices: Set<string> }
  >();

  for (const sale of completed) {
    for (const item of sale.items) {
      const name = item.product
        ? collectionLabel(item.product)
        : item.metal === "GOLD"
          ? "Gold"
          : item.description.toLowerCase().includes("diamond")
            ? "Diamond"
            : "Other / Loose";
      const row = collectionMap.get(name) ?? {
        name,
        revenue: 0,
        qty: 0,
        invoices: new Set<string>(),
      };
      row.revenue += item.amount;
      row.qty += item.quantity;
      row.invoices.add(sale.id);
      collectionMap.set(name, row);
    }
  }

  const collections = [...collectionMap.values()]
    .map((c) => ({
      name: c.name,
      revenue: c.revenue,
      qty: c.qty,
      invoiceCount: c.invoices.size,
      sharePct: grossRevenue > 0 ? (c.revenue / grossRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // —— Salespeople ——
  const staffMap = new Map<
    string,
    { id: string; name: string; revenue: number; invoices: number; items: number }
  >();

  for (const sale of completed) {
    const id = sale.employeeId || "unassigned";
    const name = sale.employee?.name || "Unassigned";
    const row = staffMap.get(id) ?? { id, name, revenue: 0, invoices: 0, items: 0 };
    row.revenue += sale.totalAmount;
    row.invoices += 1;
    row.items += sale.items.reduce((s, i) => s + i.quantity, 0);
    staffMap.set(id, row);
  }

  const salespeople = [...staffMap.values()]
    .map((s) => ({
      ...s,
      avgTicket: s.invoices > 0 ? s.revenue / s.invoices : 0,
      sharePct: grossRevenue > 0 ? (s.revenue / grossRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // —— Slow movers (stock sitting too long) ——
  const products = await prisma.product.findMany({
    where: {
      quantity: { gt: 0 },
      status: { in: ["IN_STOCK", "RESERVED"] },
    },
    include: {
      category: true,
      saleItems: {
        include: { sale: { select: { saleDate: true, status: true, txnType: true } } },
        orderBy: { sale: { saleDate: "desc" } },
        take: 5,
      },
    },
  });

  const slowMovers = products
    .map((p) => {
      const lastSale = p.saleItems.find(
        (si) => si.sale.status === "COMPLETED" && !isSaleReturn(si.sale.txnType)
      );
      const lastSoldAt = lastSale?.sale.saleDate ?? null;
      const anchor = lastSoldAt ?? p.createdAt;
      const daysIdle = daysBetween(anchor, now);
      const neverSold = !lastSoldAt;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        collection: collectionLabel(p),
        quantity: p.quantity,
        sellingPrice: p.sellingPrice,
        stockValue: p.sellingPrice * p.quantity,
        daysIdle,
        neverSold,
        lastSoldAt,
        createdAt: p.createdAt,
        risk:
          daysIdle >= 180 || (neverSold && daysIdle >= 90)
            ? ("high" as const)
            : daysIdle >= 90
              ? ("medium" as const)
              : ("low" as const),
      };
    })
    .filter((p) => p.daysIdle >= 60)
    .sort((a, b) => b.daysIdle - a.daysIdle || b.stockValue - a.stockValue)
    .slice(0, 25);

  // —— Repeat purchase likelihood (RFM-style) ——
  const allCustomerSales = await prisma.sale.findMany({
    where: {
      status: "COMPLETED",
      OR: [{ customerId: { not: null } }, { customerName: { not: null } }],
    },
    select: {
      id: true,
      customerId: true,
      customerName: true,
      saleDate: true,
      totalAmount: true,
      txnType: true,
      customer: { select: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: { saleDate: "desc" },
  });

  type CustAgg = {
    key: string;
    id: string | null;
    name: string;
    phone: string | null;
    email: string | null;
    purchases: number;
    revenue: number;
    lastPurchase: Date;
    firstPurchase: Date;
  };

  const custMap = new Map<string, CustAgg>();
  for (const sale of allCustomerSales) {
    if (isSaleReturn(sale.txnType)) continue;
    const key = sale.customerId || `name:${(sale.customerName || "").trim().toLowerCase()}`;
    if (!key || key === "name:") continue;
    const name = sale.customer?.name || sale.customerName || "Customer";
    const existing = custMap.get(key);
    if (!existing) {
      custMap.set(key, {
        key,
        id: sale.customerId,
        name,
        phone: sale.customer?.phone ?? null,
        email: sale.customer?.email ?? null,
        purchases: 1,
        revenue: sale.totalAmount,
        lastPurchase: sale.saleDate,
        firstPurchase: sale.saleDate,
      });
    } else {
      existing.purchases += 1;
      existing.revenue += sale.totalAmount;
      if (sale.saleDate > existing.lastPurchase) existing.lastPurchase = sale.saleDate;
      if (sale.saleDate < existing.firstPurchase) existing.firstPurchase = sale.saleDate;
    }
  }

  const customers = [...custMap.values()].map((c) => {
    const recencyDays = daysBetween(c.lastPurchase, now);
    const tenureDays = Math.max(1, daysBetween(c.firstPurchase, now));
    const frequency = c.purchases;
    const monetary = c.revenue;
    const avgOrder = monetary / frequency;

    // Score 0–100: higher = more likely to buy again
    const recencyScore =
      recencyDays <= 30 ? 40 : recencyDays <= 90 ? 30 : recencyDays <= 180 ? 18 : recencyDays <= 365 ? 8 : 0;
    const frequencyScore =
      frequency >= 5 ? 35 : frequency >= 3 ? 28 : frequency === 2 ? 18 : 8;
    const monetaryScore =
      monetary >= 500000 ? 25 : monetary >= 150000 ? 18 : monetary >= 50000 ? 12 : 6;

    // Penalize one-time buyers who are very old
    let score = recencyScore + frequencyScore + monetaryScore;
    if (frequency === 1 && recencyDays > 180) score = Math.min(score, 25);
    if (frequency >= 2 && recencyDays <= 120) score = Math.min(100, score + 5);

    const likelihood =
      score >= 70 ? ("high" as const) : score >= 45 ? ("medium" as const) : ("low" as const);

    const reason =
      likelihood === "high"
        ? frequency >= 3
          ? `Bought ${frequency}×; last visit ${recencyDays}d ago — strong habit`
          : `Recent high-value buyer (${recencyDays}d); nurture with new arrivals`
        : likelihood === "medium"
          ? frequency >= 2
            ? `Repeat buyer, last purchase ${recencyDays}d ago — good for a follow-up`
            : `Single purchase still warm (${recencyDays}d) — invite back`
          : frequency === 1
            ? `One-time buyer, ${recencyDays}d quiet — low priority unless promo`
            : `Inactive ${recencyDays}d after ${frequency} purchases — win-back offer`;

    return {
      id: c.id,
      key: c.key,
      name: c.name,
      phone: c.phone,
      email: c.email,
      purchases: frequency,
      revenue: monetary,
      avgOrder,
      lastPurchase: c.lastPurchase,
      recencyDays,
      tenureDays,
      score,
      likelihood,
      reason,
    };
  });

  const likelyBuyers = customers
    .filter((c) => c.likelihood === "high" || c.likelihood === "medium")
    .sort((a, b) => b.score - a.score || a.recencyDays - b.recencyDays)
    .slice(0, 20);

  const atRiskCustomers = customers
    .filter((c) => c.purchases >= 2 && c.recencyDays > 180)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // —— VIP high-value repurchase scoring ——
  const vipScores = customers
    .map((c) => {
      const valueScore =
        c.avgOrder >= 200000 ? 40 : c.avgOrder >= 80000 ? 28 : c.avgOrder >= 30000 ? 16 : 6;
      const vipScore = Math.min(100, c.score + valueScore - (c.recencyDays > 365 ? 15 : 0));
      const tier =
        vipScore >= 75 ? ("platinum" as const) : vipScore >= 55 ? ("gold" as const) : ("watch" as const);
      return {
        ...c,
        vipScore,
        tier,
        nextAction:
          tier === "platinum"
            ? "Personal invite to new high-carat / bridal pieces"
            : tier === "gold"
              ? "Share curated collection matching past spend band"
              : "Soft nurture — newsletter or festival offer",
      };
    })
    .filter((c) => c.avgOrder >= 25000 || c.revenue >= 75000)
    .sort((a, b) => b.vipScore - a.vipScore)
    .slice(0, 15);

  // —— Monthly sales forecast (simple trend) ——
  const histSales = await prisma.sale.findMany({
    where: {
      status: "COMPLETED",
      saleDate: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
    },
    select: { saleDate: true, totalAmount: true, txnType: true },
  });

  const monthMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, 0);
  }
  for (const s of histSales) {
    if (isSaleReturn(s.txnType)) continue;
    const key = `${s.saleDate.getFullYear()}-${String(s.saleDate.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + s.totalAmount);
  }
  const monthlySeries = [...monthMap.entries()].map(([month, revenue]) => ({ month, revenue }));
  const recent3 = monthlySeries.slice(-3).map((m) => m.revenue);
  const prior3 = monthlySeries.slice(-6, -3).map((m) => m.revenue);
  const avgRecent = recent3.length ? recent3.reduce((a, b) => a + b, 0) / recent3.length : 0;
  const avgPrior = prior3.length ? prior3.reduce((a, b) => a + b, 0) / prior3.length : avgRecent;
  const trendPct = avgPrior > 0 ? ((avgRecent - avgPrior) / avgPrior) * 100 : 0;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  const forecastNext = Math.max(0, avgRecent * (1 + Math.max(-0.25, Math.min(0.35, trendPct / 100))));
  const forecast = {
    monthlySeries,
    nextMonth: nextMonthKey,
    predictedRevenue: forecastNext,
    trendPct,
    confidence: monthlySeries.filter((m) => m.revenue > 0).length >= 3 ? ("medium" as const) : ("low" as const),
  };

  // —— Demand by metal / purity / price band ——
  const metalDemand = new Map<string, { key: string; qty: number; revenue: number }>();
  const purityDemand = new Map<string, { key: string; qty: number; revenue: number }>();
  const priceBands = [
    { key: "Under 25k", min: 0, max: 25000 },
    { key: "25k–75k", min: 25000, max: 75000 },
    { key: "75k–2L", min: 75000, max: 200000 },
    { key: "2L+", min: 200000, max: Infinity },
  ];
  const bandDemand = priceBands.map((b) => ({ ...b, qty: 0, revenue: 0 }));

  for (const sale of completed) {
    for (const item of sale.items) {
      const metal = (item.metal || item.product?.metal || "UNKNOWN").toUpperCase();
      const purity = item.purity || item.product?.purity || "Unset";
      const m = metalDemand.get(metal) ?? { key: metal, qty: 0, revenue: 0 };
      m.qty += item.quantity;
      m.revenue += item.amount;
      metalDemand.set(metal, m);
      const p = purityDemand.get(purity) ?? { key: purity, qty: 0, revenue: 0 };
      p.qty += item.quantity;
      p.revenue += item.amount;
      purityDemand.set(purity, p);
      const unit = item.quantity > 0 ? item.amount / item.quantity : item.amount;
      const band = bandDemand.find((b) => unit >= b.min && unit < b.max);
      if (band) {
        band.qty += item.quantity;
        band.revenue += item.amount;
      }
    }
  }

  const demand = {
    metals: [...metalDemand.values()].sort((a, b) => b.revenue - a.revenue),
    purities: [...purityDemand.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    priceBands: bandDemand,
  };

  // —— Dead stock + inventory actions ——
  const deadStock = slowMovers
    .filter((p) => p.risk === "high" || p.daysIdle >= 120)
    .map((p) => ({
      ...p,
      action:
        p.neverSold && p.daysIdle >= 150
          ? ("discontinue" as const)
          : p.daysIdle >= 180
            ? ("markdown" as const)
            : ("transfer_or_display" as const),
      actionLabel:
        p.neverSold && p.daysIdle >= 150
          ? "Consider discontinue / melt"
          : p.daysIdle >= 180
            ? "Markdown or festival promo"
            : "Move to front display / transfer",
    }))
    .slice(0, 20);

  const sellThroughByCollection = new Map<string, { sold: number; stock: number }>();
  for (const c of collections) {
    sellThroughByCollection.set(c.name, { sold: c.qty, stock: 0 });
  }
  for (const p of products) {
    const name = collectionLabel(p);
    const row = sellThroughByCollection.get(name) ?? { sold: 0, stock: 0 };
    row.stock += p.quantity;
    sellThroughByCollection.set(name, row);
  }
  const reorderHints = [...sellThroughByCollection.entries()]
    .map(([name, v]) => {
      const coverDays =
        v.sold > 0
          ? Math.round((v.stock / (v.sold / Math.max(1, daysBetween(from, to) || 30))) * 30)
          : v.stock > 0
            ? 999
            : 0;
      const action =
        v.sold > 0 && v.stock <= Math.max(1, Math.ceil(v.sold * 0.25))
          ? ("reorder" as const)
          : coverDays > 180 && v.stock > 0
            ? ("reduce" as const)
            : ("hold" as const);
      return { collection: name, sold: v.sold, stock: v.stock, coverDays, action };
    })
    .filter((r) => r.action !== "hold")
    .sort((a, b) => (a.action === "reorder" ? -1 : 1))
    .slice(0, 12);

  // —— Product recommendations for top VIP customers ——
  const topSellingProducts = new Map<
    string,
    { id: string; name: string; sku: string; collection: string; qty: number; revenue: number }
  >();
  for (const sale of completed) {
    for (const item of sale.items) {
      if (!item.productId || !item.product) continue;
      const row = topSellingProducts.get(item.productId) ?? {
        id: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        collection: collectionLabel(item.product),
        qty: 0,
        revenue: 0,
      };
      row.qty += item.quantity;
      row.revenue += item.amount;
      topSellingProducts.set(item.productId, row);
    }
  }
  const bestsellers = [...topSellingProducts.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  const inStockByCollection = new Map<string, typeof products>();
  for (const p of products) {
    if (p.quantity <= 0) continue;
    const col = collectionLabel(p);
    const list = inStockByCollection.get(col) ?? [];
    list.push(p);
    inStockByCollection.set(col, list);
  }

  const recommendations = vipScores.slice(0, 8).map((c) => {
    const topCol = bestsellers[0]?.collection;
    const fromCollection =
      (topCol && inStockByCollection.get(topCol)?.[0]) ||
      products.find((p) => p.quantity > 0 && p.sellingPrice <= c.avgOrder * 1.25) ||
      null;
    const byTicket =
      products
        .filter((p) => p.quantity > 0)
        .sort(
          (a, b) =>
            Math.abs(a.sellingPrice - c.avgOrder) - Math.abs(b.sellingPrice - c.avgOrder)
        )[0] || null;
    const product = fromCollection || byTicket;
    return {
      customerId: c.id,
      customerName: c.name,
      avgOrder: c.avgOrder,
      suggestSku: product?.sku ?? null,
      suggestName: product?.name ?? "New arrivals in their spend band",
      suggestPrice: product?.sellingPrice ?? c.avgOrder,
      reason: product
        ? `Priced near their avg ticket (${Math.round(c.avgOrder).toLocaleString("en-IN")})`
        : "Show bridal / festival highlights matching past spend",
    };
  });

  // —— Dynamic pricing / discount guidance ——
  const settings = await prisma.shopSettings.findFirst();
  const discountSamples = completed
    .filter((s) => s.discount > 0 && s.subtotal > 0)
    .map((s) => ({
      id: s.id,
      invoice: s.invoiceNumber,
      discountPct: (s.discount / s.subtotal) * 100,
      discount: s.discount,
      total: s.totalAmount,
      employee: s.employee?.name || "Unassigned",
    }));
  const avgDiscountPct =
    discountSamples.length > 0
      ? discountSamples.reduce((s, x) => s + x.discountPct, 0) / discountSamples.length
      : 0;
  const maxHealthyDiscount = Math.max(3, Math.min(12, avgDiscountPct * 1.5 || 5));
  const pricingGuidance = {
    avgDiscountPct,
    recommendedMaxDiscountPct: Math.round(maxHealthyDiscount * 10) / 10,
    makingChargePct: settings?.makingChargePct ?? 12,
    note: `Keep discounts ≤ ${Math.round(maxHealthyDiscount)}% unless manager-approved to protect making-charge margin.`,
    highDiscountInvoices: discountSamples
      .filter((d) => d.discountPct > maxHealthyDiscount)
      .sort((a, b) => b.discountPct - a.discountPct)
      .slice(0, 10),
  };

  // —— Fraud / anomaly flags ——
  const anomalies: Array<{
    type: string;
    severity: "high" | "medium";
    title: string;
    detail: string;
    href?: string;
  }> = [];

  for (const d of pricingGuidance.highDiscountInvoices.slice(0, 5)) {
    anomalies.push({
      type: "discount",
      severity: d.discountPct >= maxHealthyDiscount * 2 ? "high" : "medium",
      title: `Unusual discount on ${d.invoice}`,
      detail: `${d.discountPct.toFixed(1)}% off by ${d.employee} (cap ~${maxHealthyDiscount.toFixed(0)}%)`,
      href: `/sales/${d.id}`,
    });
  }

  const returnRate = invoiceCount > 0 ? returns.length / invoiceCount : 0;
  if (returnRate >= 0.15 && returns.length >= 2) {
    anomalies.push({
      type: "returns",
      severity: returnRate >= 0.3 ? "high" : "medium",
      title: "Elevated return rate",
      detail: `${(returnRate * 100).toFixed(0)}% of period invoices are returns (${returns.length}) — review quality or sales pressure.`,
      href: "/sales",
    });
  }

  const largeReturns = returns
    .filter((r) => r.totalAmount >= Math.max(50000, analyticsAvgTicket(completed) * 2))
    .slice(0, 5);
  for (const r of largeReturns) {
    anomalies.push({
      type: "return",
      severity: "medium",
      title: `Large return ${r.invoiceNumber}`,
      detail: `${Math.round(r.totalAmount).toLocaleString("en-IN")} — check reason and stock restock.`,
      href: `/sales/${r.id}`,
    });
  }

  // —— Staff analytics (margin proxy + repeats) ——
  const staffDeep = salespeople.map((s) => {
    const staffSales = completed.filter(
      (sale) => (sale.employeeId || "unassigned") === s.id
    );
    const discounts = staffSales.reduce((sum, sale) => sum + sale.discount, 0);
    const making = staffSales.reduce((sum, sale) => sum + sale.makingCharges, 0);
    const repeatCustomers = new Set(
      staffSales
        .filter((sale) => sale.customerId)
        .map((sale) => sale.customerId as string)
        .filter((cid) => (custMap.get(cid)?.purchases || 0) >= 2)
    ).size;
    const discountPct = s.revenue > 0 ? (discounts / (s.revenue + discounts)) * 100 : 0;
    return {
      ...s,
      discountGiven: discounts,
      discountPct,
      makingCharges: making,
      marginProxy: s.revenue - discounts + making * 0.15,
      repeatCustomers,
    };
  });

  // —— Production planning hints ——
  const openJobs = await prisma.manufacturingJob.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    select: {
      metal: true,
      issuedWeight: true,
      labourCost: true,
      designName: true,
      status: true,
    },
  });
  const metalNeed = new Map<string, number>();
  for (const j of openJobs) {
    metalNeed.set(j.metal, (metalNeed.get(j.metal) || 0) + j.issuedWeight);
  }
  const topMetal = demand.metals[0];
  const productionPlan = {
    openJobs: openJobs.length,
    metalIssued: [...metalNeed.entries()].map(([metal, grams]) => ({ metal, grams })),
    labourPipeline: openJobs.reduce((s, j) => s + j.labourCost, 0),
    suggestion: topMetal
      ? `Demand favors ${topMetal.key} — prioritize open jobs and material purchase for that metal.`
      : "Add sales in period to guide factory metal mix.",
  };

  // —— AI-style insight narratives ——
  const insights: string[] = [];
  const topCollection = collections[0];
  if (topCollection) {
    insights.push(
      `${topCollection.name} leads collections with ${topCollection.sharePct.toFixed(0)}% of period revenue (${topCollection.qty} pieces).`
    );
  } else {
    insights.push("No completed sales in this period yet — insights will appear after invoices are posted.");
  }

  const topStaff = salespeople.find((s) => s.id !== "unassigned") ?? salespeople[0];
  if (topStaff && topStaff.revenue > 0) {
    insights.push(
      `${topStaff.name} is the top performer with ${topStaff.invoices} invoice${topStaff.invoices === 1 ? "" : "s"} and average ticket value reflecting strong closing.`
    );
  }

  const highIdle = slowMovers.filter((p) => p.risk === "high");
  if (highIdle.length > 0) {
    const value = highIdle.reduce((s, p) => s + p.stockValue, 0);
    insights.push(
      `${highIdle.length} piece${highIdle.length === 1 ? "" : "s"} have sat 90+ days idle with ~${Math.round(value).toLocaleString("en-IN")} in tied-up retail value — refresh display or run a targeted offer.`
    );
  } else if (slowMovers.length > 0) {
    insights.push(
      `${slowMovers.length} stock item${slowMovers.length === 1 ? "" : "s"} have been idle 60+ days — watch ageing before they become dead stock.`
    );
  } else {
    insights.push("Stock turnover looks healthy — no items idle beyond 60 days.");
  }

  if (likelyBuyers.length > 0) {
    const hot = likelyBuyers.filter((c) => c.likelihood === "high").length;
    insights.push(
      `${likelyBuyers.length} customer${likelyBuyers.length === 1 ? "" : "s"} look ready to buy again${hot ? ` (${hot} high probability)` : ""} — prioritize personal outreach on new collections.`
    );
  }

  if (atRiskCustomers.length > 0) {
    insights.push(
      `${atRiskCustomers.length} former repeat buyer${atRiskCustomers.length === 1 ? "" : "s"} have gone quiet 180+ days — win-back messaging may recover revenue.`
    );
  }

  insights.push(
    `Next-month forecast ≈ ${Math.round(forecast.predictedRevenue).toLocaleString("en-IN")} (${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(0)}% vs prior quarter pace, ${forecast.confidence} confidence).`
  );

  if (demand.metals[0]) {
    insights.push(
      `Demand mix: ${demand.metals[0].key} leads metal preference; top price band is ${
        [...bandDemand].sort((a, b) => b.revenue - a.revenue)[0]?.key || "n/a"
      }.`
    );
  }

  if (deadStock.length > 0) {
    insights.push(
      `${deadStock.length} dead-stock candidate${deadStock.length === 1 ? "" : "s"} flagged for markdown, transfer, or discontinue.`
    );
  }

  if (pricingGuidance.highDiscountInvoices.length > 0) {
    insights.push(
      `${pricingGuidance.highDiscountInvoices.length} invoice${pricingGuidance.highDiscountInvoices.length === 1 ? "" : "s"} exceeded the suggested ${pricingGuidance.recommendedMaxDiscountPct}% discount cap.`
    );
  }

  if (vipScores.length > 0) {
    insights.push(
      `${vipScores.filter((v) => v.tier === "platinum").length} platinum-tier clients scored for another high-value purchase — route to senior sales.`
    );
  }

  if (anomalies.length > 0) {
    insights.push(`${anomalies.length} anomaly flag${anomalies.length === 1 ? "" : "s"} need review (discounts / returns).`);
  }

  if (productionPlan.openJobs > 0) {
    insights.push(productionPlan.suggestion);
  }

  return {
    period: { from, to },
    summary: {
      grossRevenue,
      returnRevenue,
      netRevenue,
      invoiceCount,
      avgTicket: invoiceCount > 0 ? grossRevenue / invoiceCount : 0,
      returnCount: returns.length,
    },
    collections,
    salespeople,
    staffDeep,
    slowMovers,
    deadStock,
    reorderHints,
    likelyBuyers,
    atRiskCustomers,
    vipScores,
    recommendations,
    forecast,
    demand,
    pricingGuidance,
    anomalies,
    productionPlan,
    bestsellers,
    insights,
  };
}

function analyticsAvgTicket(completed: Array<{ totalAmount: number }>) {
  if (completed.length === 0) return 0;
  return completed.reduce((s, x) => s + x.totalAmount, 0) / completed.length;
}

export type SalesAnalytics = Awaited<ReturnType<typeof getSalesAnalytics>>;
