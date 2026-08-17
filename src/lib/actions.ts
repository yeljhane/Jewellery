"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { nextInvoiceNumber, nextJobNumber, nextPoNumber, nextSku } from "@/lib/data";
import { calcJewelleryAmount } from "@/lib/utils";
import {
  deleteJournalBySource,
  deleteJournalsBySourceIds,
  postExpenseJournal,
  postJournal,
  postPurchaseJournal,
  postReceivableCollectionJournal,
  postSaleJournal,
} from "@/lib/accounting";
import { requireAuth, requireOwnerOrManager, requireRole } from "@/lib/auth";
import { accrueSaleCommission, markSerialsSold } from "@/lib/jewelry-pos";
import { assertNonNegativeStock, recordStockMovement } from "@/lib/inventory-security";
import { z } from "zod";
import bcrypt from "bcryptjs";

type IncomingSaleItem = {
  productId?: string | null;
  inventoryItemId?: string | null;
  description?: string;
  metal?: string | null;
  purity?: string | null;
  netWeight?: number;
  quantity?: number;
  metalRate?: number;
  makingCharge?: number;
  stoneCharge?: number;
  wastagePct?: number;
  amount?: number;
};

type IncomingPayment = {
  method?: string;
  amount?: number;
  currency?: string;
  foreignAmount?: number;
  exchangeRate?: number;
  reference?: string | null;
};

function parseSaleItems(formData: FormData, metalRateFallback: number): IncomingSaleItem[] {
  let incoming: IncomingSaleItem[] = [];
  const rawJson = String(formData.get("itemsJson") || "").trim();
  if (rawJson) {
    try {
      incoming = JSON.parse(rawJson) as IncomingSaleItem[];
    } catch {
      incoming = [];
    }
  }
  if (incoming.length === 0) {
    const productId = formData.get("productId") as string;
    incoming = [
      {
        productId: productId || null,
        description: String(formData.get("description") || "Jewellery item"),
        metal: (formData.get("metal") as string) || "GOLD",
        purity: (formData.get("purity") as string) || null,
        netWeight: Number(formData.get("netWeight") || 0),
        quantity: 1,
        metalRate: metalRateFallback,
        makingCharge: Number(formData.get("makingCharge") || 0),
        stoneCharge: Number(formData.get("stoneCharge") || 0),
        wastagePct: Number(formData.get("wastagePct") || 2),
      },
    ];
  }
  return incoming;
}

function buildSaleLineRows(incoming: IncomingSaleItem[], metalRateFallback: number) {
  const lineRows = [];
  let subtotal = 0;
  let makingCharges = 0;
  for (const item of incoming) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const netWeight = Number(item.netWeight) || 0;
    const metalRate = Number(item.metalRate) || metalRateFallback;
    const makingCharge = Number(item.makingCharge) || 0;
    const stoneCharge = Number(item.stoneCharge) || 0;
    const wastagePct = Number(item.wastagePct) || 0;
    const unitAmount = calcJewelleryAmount({
      netWeight,
      metalRate,
      makingCharge,
      stoneCharge,
      wastagePct,
    });
    const amount = Number(item.amount) || unitAmount * qty;
    subtotal += amount;
    makingCharges += makingCharge * qty;
    lineRows.push({
      productId: item.productId || null,
      inventoryItemId: item.inventoryItemId || null,
      description: item.description || "Jewellery item",
      metal: item.metal || null,
      purity: item.purity || null,
      netWeight,
      quantity: qty,
      metalRate,
      makingCharge,
      stoneCharge,
      amount,
    });
  }
  return { lineRows, subtotal, makingCharges };
}

async function assertSaleItemsMatchScope(
  txnType: string,
  items: Array<{ productId?: string | null; description?: string }>
) {
  const { saleJewelleryScope } = await import("@/lib/txn-types");
  const { isDiamondProduct } = await import("@/lib/products");
  const scope = saleJewelleryScope(txnType);
  if (scope === "ALL") return;

  const productIds = items
    .map((i) => i.productId)
    .filter((id): id is string => Boolean(id));
  if (productIds.length === 0) return;

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { category: true },
  });
  for (const product of products) {
    const diamond = isDiamondProduct(product);
    if (scope === "DIAMOND" && !diamond) {
      throw new Error("Diamond sales can only include diamond stock items.");
    }
    if (scope === "GOLD" && diamond) {
      throw new Error("Gold sales can only include gold stock items.");
    }
  }
}

function parseSalePayments(formData: FormData, totalAmount: number, baseCurrency = "INR") {
  const base = baseCurrency.toUpperCase();
  let payments: IncomingPayment[] = [];
  const paymentsRaw = String(formData.get("paymentsJson") || "").trim();
  if (paymentsRaw) {
    try {
      payments = JSON.parse(paymentsRaw) as IncomingPayment[];
    } catch {
      payments = [];
    }
  }
  payments = payments
    .map((p) => {
      const currency = String(p.currency || base).toUpperCase();
      const exchangeRate =
        currency === base ? 1 : Number(p.exchangeRate) > 0 ? Number(p.exchangeRate) : 1;
      const foreignAmount =
        p.foreignAmount != null && Number(p.foreignAmount) > 0
          ? Number(p.foreignAmount)
          : Number(p.amount) || 0;
      const amount =
        Number(p.amount) > 0
          ? Number(p.amount)
          : Math.round(foreignAmount * exchangeRate * 100) / 100;
      return {
        method: String(p.method || "CASH").toUpperCase(),
        amount,
        currency,
        foreignAmount,
        exchangeRate,
        reference: p.reference ? String(p.reference) : null,
      };
    })
    .filter((p) => (p.amount || 0) > 0);

  if (payments.length === 0) {
    const method = String(formData.get("paymentMethod") || "CASH").toUpperCase();
    const paidField = formData.get("paidAmount");
    const amount =
      paidField === null || paidField === "" ? totalAmount : Number(paidField) || 0;
    if (amount > 0) {
      payments = [
        {
          method,
          amount,
          currency: base,
          foreignAmount: amount,
          exchangeRate: 1,
          reference: null,
        },
      ];
    }
  }

  const paidAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const methods = [...new Set(payments.map((p) => p.method!))];
  const paymentMethod =
    methods.length === 0 ? "CASH" : methods.length === 1 ? methods[0] : "MIXED";
  return { payments, paidAmount, paymentMethod };
}

async function applySaleStock(
  lineRows: Array<{ productId: string | null; quantity: number }>,
  isReturn: boolean,
  reverse = false
) {
  const restore = reverse ? !isReturn : isReturn;
  for (const row of lineRows) {
    if (!row.productId) continue;
    const product = await prisma.product.findUnique({ where: { id: row.productId } });
    if (!product) continue;
    if (restore) {
      const qtyAfter = product.quantity + row.quantity;
      await prisma.product.update({
        where: { id: product.id },
        data: {
          quantity: qtyAfter,
          status: "IN_STOCK",
        },
      });
      await recordStockMovement({
        productId: product.id,
        movementType: "RETURN",
        quantityDelta: row.quantity,
        qtyBefore: product.quantity,
        qtyAfter,
        note: `Stock restore for ${product.sku}`,
      });
    } else {
      assertNonNegativeStock(product.quantity, row.quantity, product.sku);
      const nextQty = product.quantity - row.quantity;
      await prisma.product.update({
        where: { id: product.id },
        data: {
          quantity: nextQty,
          status: nextQty <= 0 ? "SOLD" : product.status === "SOLD" ? "IN_STOCK" : product.status,
        },
      });
      await recordStockMovement({
        productId: product.id,
        movementType: "SALE",
        quantityDelta: -row.quantity,
        qtyBefore: product.quantity,
        qtyAfter: nextQty,
        note: `Sale issue for ${product.sku}`,
      });
    }
  }
}

async function resolveSaleCustomer(formData: FormData) {
  const customerIdRaw = String(formData.get("customerId") || "").trim();
  const customerName = String(formData.get("customerName") || "").trim() || null;

  if (customerIdRaw) {
    const customer = await prisma.customer.findUnique({ where: { id: customerIdRaw } });
    if (customer) {
      return {
        customerId: customer.id,
        customerName: customerName || customer.name,
      };
    }
  }

  return { customerId: null as string | null, customerName };
}

async function reversePurchaseMaterials(
  poNumber: string,
  fallback?: {
    supplierId: string;
    items: Array<{ description: string; weightGrams: number; metal: string | null }>;
  }
) {
  const mats = await prisma.rawMaterial.findMany({
    where: { notes: `From PO ${poNumber}` },
  });

  // Older receives (before notes tagging): best-effort match
  if (mats.length === 0 && fallback) {
    for (const item of fallback.items) {
      if (!item.metal || item.weightGrams <= 0) continue;
      const match = await prisma.rawMaterial.findFirst({
        where: {
          supplierId: fallback.supplierId,
          name: item.description,
          metal: item.metal,
          weightGrams: item.weightGrams,
          OR: [{ notes: null }, { notes: { not: { contains: "From PO" } } }],
        },
        orderBy: { createdAt: "desc" },
      });
      if (match) mats.push(match);
    }
  }

  for (const m of mats) {
    const used = await prisma.jobMaterial.count({ where: { rawMaterialId: m.id } });
    if (used > 0) {
      await prisma.rawMaterial.update({
        where: { id: m.id },
        data: {
          weightGrams: 0,
          quantity: 0,
          notes: `${m.notes || ""} · reversed (PO deleted/edited)`,
        },
      });
    } else {
      await prisma.rawMaterial.delete({ where: { id: m.id } });
    }
  }
}

async function applyFinishedPurchaseStock(
  items: Array<{ productId: string | null; quantity: number }>,
  isReturn: boolean,
  reverse = false
) {
  const remove = reverse ? !isReturn : isReturn;
  for (const item of items) {
    if (!item.productId) continue;
    const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) continue;
    if (remove) {
      const nextQty = Math.max(0, product.quantity - qty);
      await prisma.product.update({
        where: { id: product.id },
        data: {
          quantity: nextQty,
          status: nextQty <= 0 ? "SOLD" : "IN_STOCK",
        },
      });
    } else {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          quantity: { increment: qty },
          status: "IN_STOCK",
        },
      });
    }
  }
}

async function applyPurchaseReceipt(po: {
  poNumber: string;
  supplierId: string;
  txnType: string;
  items: Array<{
    productId: string | null;
    description: string;
    metal: string | null;
    purity: string | null;
    weightGrams: number;
    quantity: number;
    rate: number;
  }>;
}) {
  const { isFinishedStockPurchase, isPurchaseReturn } = await import("@/lib/txn-types");
  if (isFinishedStockPurchase(po.txnType)) {
    await applyFinishedPurchaseStock(po.items, isPurchaseReturn(po.txnType));
  } else {
    await addPurchaseMaterials(po);
  }
}

async function reversePurchaseReceipt(po: {
  id: string;
  poNumber: string;
  supplierId: string;
  txnType: string;
  items: Array<{
    productId: string | null;
    description: string;
    metal: string | null;
    purity: string | null;
    weightGrams: number;
    quantity: number;
  }>;
}) {
  const { isFinishedStockPurchase, isPurchaseReturn } = await import("@/lib/txn-types");
  if (isFinishedStockPurchase(po.txnType)) {
    await applyFinishedPurchaseStock(po.items, isPurchaseReturn(po.txnType), true);
  } else {
    await reversePurchaseMaterials(po.poNumber, {
      supplierId: po.supplierId,
      items: po.items,
    });
  }
}

async function addPurchaseMaterials(po: {
  poNumber: string;
  supplierId: string;
  items: Array<{
    description: string;
    metal: string | null;
    purity: string | null;
    weightGrams: number;
    rate: number;
  }>;
}) {
  for (const item of po.items) {
    if (item.metal && item.weightGrams > 0) {
      await prisma.rawMaterial.create({
        data: {
          name: item.description,
          type: "METAL",
          metal: item.metal,
          purity: item.purity,
          weightGrams: item.weightGrams,
          quantity: item.weightGrams,
          unit: "g",
          costPerUnit: item.rate,
          supplierId: po.supplierId,
          notes: `From PO ${po.poNumber}`,
        },
      });
    }
  }
}

export async function createProduct(formData: FormData) {
  const sku = (formData.get("sku") as string) || (await nextSku());
  const imageFile = formData.get("image") as File | null;
  const imageUrlField = String(formData.get("imageUrl") || "").trim();
  let imageUrl: string | null = imageUrlField || null;
  if (imageFile && imageFile.size > 0) {
    const { saveProductImage } = await import("@/lib/products");
    imageUrl = (await saveProductImage(imageFile)) || imageUrl;
  }

  const qty = Number(formData.get("quantity") || 1);
  await prisma.product.create({
    data: {
      sku,
      name: String(formData.get("name")),
      categoryId: (formData.get("categoryId") as string) || null,
      jewelleryType: String(formData.get("jewelleryType") || "GOLD"),
      metal: String(formData.get("metal") || "GOLD"),
      purity: (formData.get("purity") as string) || null,
      grossWeight: Number(formData.get("grossWeight") || 0),
      netWeight: Number(formData.get("netWeight") || 0),
      stoneWeight: Number(formData.get("stoneWeight") || 0),
      stoneDetails: (formData.get("stoneDetails") as string) || null,
      makingCharge: Number(formData.get("makingCharge") || 0),
      wastagePct: Number(formData.get("wastagePct") || 0),
      costPrice: Number(formData.get("costPrice") || 0),
      sellingPrice: Number(formData.get("sellingPrice") || 0),
      quantity: qty,
      imageUrl,
      notes: (formData.get("notes") as string) || null,
      status: qty > 0 ? "IN_STOCK" : "SOLD",
    },
  });
  revalidatePath("/inventory");
  revalidatePath("/");
  redirect("/inventory");
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id"));
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new Error("Product not found");

  const imageFile = formData.get("image") as File | null;
  const imageUrlField = String(formData.get("imageUrl") || "").trim();
  let imageUrl: string | null = imageUrlField || existing.imageUrl;

  if (imageFile && imageFile.size > 0) {
    const { saveProductImage } = await import("@/lib/products");
    imageUrl = (await saveProductImage(imageFile)) || imageUrl;
  }

  const qty = Number(formData.get("quantity") ?? existing.quantity);
  const statusInput = String(formData.get("status") || existing.status);
  const status =
    statusInput === "SOLD" || statusInput === "RESERVED" || statusInput === "IN_PRODUCTION"
      ? statusInput
      : qty > 0
        ? "IN_STOCK"
        : "SOLD";

  await prisma.product.update({
    where: { id },
    data: {
      sku: String(formData.get("sku") || existing.sku),
      name: String(formData.get("name") || existing.name),
      categoryId: (formData.get("categoryId") as string) || null,
      jewelleryType: String(formData.get("jewelleryType") || existing.jewelleryType || "GOLD"),
      metal: String(formData.get("metal") || existing.metal || "GOLD"),
      purity: (formData.get("purity") as string) || null,
      grossWeight: Number(formData.get("grossWeight") || 0),
      netWeight: Number(formData.get("netWeight") || 0),
      stoneWeight: Number(formData.get("stoneWeight") || 0),
      stoneDetails: (formData.get("stoneDetails") as string) || null,
      makingCharge: Number(formData.get("makingCharge") || 0),
      wastagePct: Number(formData.get("wastagePct") || 0),
      costPrice: Number(formData.get("costPrice") || 0),
      sellingPrice: Number(formData.get("sellingPrice") || 0),
      quantity: qty,
      imageUrl,
      notes: (formData.get("notes") as string) || null,
      status,
    },
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}/edit`);
  revalidatePath("/");
  redirect("/inventory");
}

export async function deleteProduct(formData: FormData) {
  const id = String(formData.get("id"));
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: { select: { saleItems: true, purchaseItems: true, jobOrders: true } },
    },
  });
  if (!product) return;

  const linked =
    product._count.saleItems + product._count.purchaseItems + product._count.jobOrders;
  if (linked > 0) {
    // Soft-remove from stock if used in history
    await prisma.product.update({
      where: { id },
      data: { quantity: 0, status: "SOLD", notes: `${product.notes || ""} · archived`.trim() },
    });
  } else {
    await prisma.product.delete({ where: { id } });
  }

  revalidatePath("/inventory");
  revalidatePath("/");
  redirect("/inventory");
}

export async function createRawMaterial(formData: FormData) {
  await prisma.rawMaterial.create({
    data: {
      name: String(formData.get("name")),
      type: String(formData.get("type") || "METAL"),
      metal: (formData.get("metal") as string) || null,
      purity: (formData.get("purity") as string) || null,
      weightGrams: Number(formData.get("weightGrams") || 0),
      quantity: Number(formData.get("quantity") || 0),
      unit: String(formData.get("unit") || "g"),
      costPerUnit: Number(formData.get("costPerUnit") || 0),
      supplierId: (formData.get("supplierId") as string) || null,
      location: (formData.get("location") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });
  revalidatePath("/materials");
}

const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  vipTier: z.enum(["STANDARD", "SILVER", "GOLD", "PLATINUM"]).optional(),
  tags: z.string().optional().nullable(),
  preferredMetal: z.string().optional().nullable(),
  preferredStone: z.string().optional().nullable(),
  marketingOptIn: z.boolean().optional(),
});

export async function createCustomer(formData: FormData) {
  await requireAuth();
  const parsed = customerSchema.parse({
    name: String(formData.get("name") || ""),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    gstin: (formData.get("gstin") as string) || null,
    notes: (formData.get("notes") as string) || null,
    vipTier: String(formData.get("vipTier") || "STANDARD"),
    tags: (formData.get("tags") as string) || null,
    preferredMetal: (formData.get("preferredMetal") as string) || null,
    preferredStone: (formData.get("preferredStone") as string) || null,
    marketingOptIn: formData.get("marketingOptIn") !== "0",
  });
  await prisma.customer.create({
    data: {
      name: parsed.name,
      phone: parsed.phone || null,
      email: parsed.email || null,
      address: parsed.address || null,
      gstin: parsed.gstin || null,
      notes: parsed.notes || null,
      vipTier: parsed.vipTier || "STANDARD",
      tags: parsed.tags || null,
      preferredMetal: parsed.preferredMetal || null,
      preferredStone: parsed.preferredStone || null,
      marketingOptIn: parsed.marketingOptIn ?? true,
    },
  });
  revalidatePath("/customers");
}

export async function updateCustomer(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") || "");
  const parsed = customerSchema.parse({
    name: String(formData.get("name") || ""),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    address: (formData.get("address") as string) || null,
    gstin: (formData.get("gstin") as string) || null,
    notes: (formData.get("notes") as string) || null,
    vipTier: String(formData.get("vipTier") || "STANDARD"),
    tags: (formData.get("tags") as string) || null,
    preferredMetal: (formData.get("preferredMetal") as string) || null,
    preferredStone: (formData.get("preferredStone") as string) || null,
    marketingOptIn: formData.get("marketingOptIn") !== "0",
  });
  await prisma.customer.update({
    where: { id },
    data: {
      name: parsed.name,
      phone: parsed.phone || null,
      email: parsed.email || null,
      address: parsed.address || null,
      gstin: parsed.gstin || null,
      notes: parsed.notes || null,
      vipTier: parsed.vipTier || "STANDARD",
      tags: parsed.tags || null,
      preferredMetal: parsed.preferredMetal || null,
      preferredStone: parsed.preferredStone || null,
      marketingOptIn: parsed.marketingOptIn ?? true,
    },
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomer(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id") || "");
  const sales = await prisma.sale.count({ where: { customerId: id } });
  if (sales > 0) {
    throw new Error("Cannot delete customer with sales history. Clear or reassign sales first.");
  }
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  redirect("/customers");
}

const collectionSchema = z.object({
  saleId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["CASH", "UPI", "CARD", "BANK"]),
  reference: z.string().optional().nullable(),
});

export async function recordSalePayment(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES", "ACCOUNTANT"]);
  const parsed = collectionSchema.parse({
    saleId: String(formData.get("saleId") || ""),
    amount: Number(formData.get("amount")),
    method: String(formData.get("method") || "CASH").toUpperCase(),
    reference: (formData.get("reference") as string) || null,
  });

  const sale = await prisma.sale.findUnique({
    where: { id: parsed.saleId },
    include: { payments: true },
  });
  if (!sale) throw new Error("Sale not found");
  if (sale.txnType.endsWith("_RETURN")) {
    throw new Error("Cannot collect payment on a return.");
  }

  const due = Math.max(0, sale.totalAmount - sale.paidAmount);
  if (due <= 0.01) throw new Error("Nothing outstanding on this invoice.");

  const amount = Math.min(parsed.amount, due);
  const settings = await prisma.shopSettings.findFirst();
  const currency = settings?.currency ?? "INR";

  const payment = await prisma.salePayment.create({
    data: {
      saleId: sale.id,
      method: parsed.method,
      amount,
      currency,
      foreignAmount: amount,
      exchangeRate: 1,
      reference: parsed.reference || null,
    },
  });

  const newPaid = sale.paidAmount + amount;
  const methods = [
    ...new Set([...sale.payments.map((p) => p.method), parsed.method]),
  ];
  await prisma.sale.update({
    where: { id: sale.id },
    data: {
      paidAmount: newPaid,
      paymentMethod: methods.length === 1 ? methods[0] : "MIXED",
    },
  });

  await postReceivableCollectionJournal({
    paymentId: payment.id,
    invoiceNumber: sale.invoiceNumber,
    amount,
    method: parsed.method,
  });

  revalidatePath("/customers");
  if (sale.customerId) revalidatePath(`/customers/${sale.customerId}`);
  revalidatePath(`/sales/${sale.id}`);
  revalidatePath("/sales");
  revalidatePath("/accounting");
  revalidatePath("/");
}

export async function createSupplier(formData: FormData) {
  await prisma.supplier.create({
    data: {
      name: String(formData.get("name")),
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      address: (formData.get("address") as string) || null,
      gstin: (formData.get("gstin") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });
  revalidatePath("/suppliers");
}

export async function createKarigar(formData: FormData) {
  await prisma.karigar.create({
    data: {
      name: String(formData.get("name")),
      phone: (formData.get("phone") as string) || null,
      specialty: (formData.get("specialty") as string) || null,
      dailyWage: formData.get("dailyWage") ? Number(formData.get("dailyWage")) : null,
      notes: (formData.get("notes") as string) || null,
    },
  });
  revalidatePath("/karigars");
}

export async function createMetalRate(formData: FormData) {
  await prisma.metalRate.create({
    data: {
      metal: String(formData.get("metal")),
      purity: String(formData.get("purity")),
      ratePerGram: Number(formData.get("ratePerGram")),
      effectiveFrom: new Date(),
    },
  });
  revalidatePath("/rates");
  revalidatePath("/");
}

export async function createExpense(formData: FormData) {
  const expense = await prisma.expense.create({
    data: {
      category: String(formData.get("category")),
      description: String(formData.get("description")),
      amount: Number(formData.get("amount")),
      paymentMethod: String(formData.get("paymentMethod") || "CASH"),
      notes: (formData.get("notes") as string) || null,
      expenseDate: formData.get("expenseDate")
        ? new Date(String(formData.get("expenseDate")))
        : new Date(),
    },
  });
  await postExpenseJournal(expense);
  revalidatePath("/expenses");
  revalidatePath("/accounting");
}

export async function createManufacturingJob(formData: FormData) {
  const jobNumber = await nextJobNumber();
  const issuedWeight = Number(formData.get("issuedWeight") || 0);
  const rawMaterialId = formData.get("rawMaterialId") as string;

  const job = await prisma.manufacturingJob.create({
    data: {
      jobNumber,
      designName: String(formData.get("designName")),
      metal: String(formData.get("metal") || "GOLD"),
      purity: (formData.get("purity") as string) || null,
      karigarId: (formData.get("karigarId") as string) || null,
      productId: (formData.get("productId") as string) || null,
      customerId: (formData.get("customerId") as string) || null,
      isCustomOrder: formData.get("isCustomOrder") === "1",
      depositAmount: Number(formData.get("depositAmount") || 0),
      issuedWeight,
      labourCost: Number(formData.get("labourCost") || 0),
      dueDate: formData.get("dueDate") ? new Date(String(formData.get("dueDate"))) : null,
      notes: (formData.get("notes") as string) || null,
      status: issuedWeight > 0 ? "IN_PROGRESS" : "PENDING",
    },
  });

  if (rawMaterialId && issuedWeight > 0) {
    await prisma.jobMaterial.create({
      data: { jobId: job.id, rawMaterialId, quantityUsed: issuedWeight },
    });
    await prisma.rawMaterial.update({
      where: { id: rawMaterialId },
      data: {
        weightGrams: { decrement: issuedWeight },
        quantity: { decrement: issuedWeight },
      },
    });
  }

  revalidatePath("/manufacturing");
  revalidatePath("/materials");
}

export async function updateJobStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const returnedWeight = Number(formData.get("returnedWeight") || 0);
  const job = await prisma.manufacturingJob.findUnique({ where: { id } });
  if (!job) return;

  const wastageWeight =
    status === "COMPLETED" && returnedWeight > 0
      ? Math.max(0, job.issuedWeight - returnedWeight)
      : job.wastageWeight;

  await prisma.manufacturingJob.update({
    where: { id },
    data: {
      status,
      returnedWeight: returnedWeight || job.returnedWeight,
      wastageWeight,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  if (status === "COMPLETED" && returnedWeight > 0) {
    const sku = await nextSku();
    await prisma.product.create({
      data: {
        sku,
        name: job.designName,
        metal: job.metal,
        purity: job.purity,
        grossWeight: returnedWeight,
        netWeight: returnedWeight,
        makingCharge: job.labourCost,
        costPrice: job.labourCost,
        sellingPrice: 0,
        quantity: 1,
        status: "IN_STOCK",
        notes: `Produced from ${job.jobNumber}`,
      },
    });
  }

  revalidatePath("/manufacturing");
  revalidatePath("/inventory");
}

export async function createPurchaseOrder(formData: FormData) {
  const { isFinishedStockPurchase } = await import("@/lib/txn-types");
  const poNumber = await nextPoNumber();
  const weight = Number(formData.get("weightGrams") || 0);
  const rate = Number(formData.get("rate") || 0);
  const quantity = Number(formData.get("quantity") || 1);
  const amount = weight > 0 ? weight * rate : quantity * rate;
  const taxAmount = amount * 0.03;
  const txnType = String(formData.get("txnType") || "GOLD_PURCHASE");
  const finished = isFinishedStockPurchase(txnType);
  const productId = String(formData.get("productId") || "").trim() || null;
  const status = String(formData.get("status") || (finished ? "RECEIVED" : "ORDERED"));

  let description = String(formData.get("description") || "").trim();
  let metal = (formData.get("metal") as string) || null;
  let purity = (formData.get("purity") as string) || null;

  if (finished) {
    if (!productId) throw new Error("Select a finished stock item.");
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product) throw new Error("Finished stock item not found.");
    const { purchaseJewelleryType } = await import("@/lib/txn-types");
    const { isDiamondProduct } = await import("@/lib/products");
    const expected = purchaseJewelleryType(txnType);
    const isDiamond = isDiamondProduct(product);
    if (expected === "DIAMOND" && !isDiamond) {
      throw new Error("Diamond purchases can only use diamond stock items.");
    }
    if (expected === "GOLD" && isDiamond) {
      throw new Error("Gold purchases can only use gold stock items.");
    }
    description = product.name;
    metal = product.metal;
    purity = product.purity;
  }

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: String(formData.get("supplierId")),
      txnType,
      status,
      subtotal: amount,
      taxAmount,
      totalAmount: amount + taxAmount,
      notes: (formData.get("notes") as string) || null,
      receivedDate: status === "RECEIVED" ? new Date() : null,
      items: {
        create: [
          {
            productId,
            description: description || "Purchase item",
            metal,
            purity,
            weightGrams: weight,
            quantity,
            rate,
            amount,
          },
        ],
      },
    },
    include: { items: true },
  });

  if (status === "RECEIVED") {
    await applyPurchaseReceipt(po);
    await postPurchaseJournal(po);
  }

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/materials");
  revalidatePath("/accounting");
  redirect(`/purchases/${po.id}`);
}

export async function receivePurchaseOrder(formData: FormData) {
  const id = String(formData.get("id"));
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!po || po.status === "RECEIVED") return;

  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "RECEIVED", receivedDate: new Date() },
  });

  await applyPurchaseReceipt(po);

  const updated = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (updated) await postPurchaseJournal(updated);

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/materials");
  revalidatePath("/accounting");
}

export async function updatePurchaseOrder(formData: FormData) {
  const { isFinishedStockPurchase } = await import("@/lib/txn-types");
  const id = String(formData.get("id"));
  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) throw new Error("Purchase order not found");

  const wasReceived = existing.status === "RECEIVED";
  if (wasReceived) {
    await reversePurchaseReceipt(existing);
    await deleteJournalBySource("PURCHASE", id);
  }

  const weight = Number(formData.get("weightGrams") || 0);
  const rate = Number(formData.get("rate") || 0);
  const quantity = Number(formData.get("quantity") || 1);
  const amount = weight > 0 ? weight * rate : quantity * rate;
  const taxAmount = amount * 0.03;
  const txnType = String(formData.get("txnType") || existing.txnType);
  const status = String(formData.get("status") || existing.status);
  const finished = isFinishedStockPurchase(txnType);
  let productId = String(formData.get("productId") || "").trim() || existing.items[0]?.productId || null;
  let description = String(formData.get("description") || existing.items[0]?.description || "Item");
  let metal = (formData.get("metal") as string) || null;
  let purity = (formData.get("purity") as string) || null;

  if (finished) {
    if (!productId) throw new Error("Select a finished stock item.");
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product) throw new Error("Finished stock item not found.");
    const { purchaseJewelleryType } = await import("@/lib/txn-types");
    const { isDiamondProduct } = await import("@/lib/products");
    const expected = purchaseJewelleryType(txnType);
    const isDiamond = isDiamondProduct(product);
    if (expected === "DIAMOND" && !isDiamond) {
      throw new Error("Diamond purchases can only use diamond stock items.");
    }
    if (expected === "GOLD" && isDiamond) {
      throw new Error("Gold purchases can only use gold stock items.");
    }
    description = product.name;
    metal = product.metal;
    purity = product.purity;
  } else {
    productId = null;
  }

  await prisma.purchaseItem.deleteMany({ where: { purchaseOrderId: id } });

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      supplierId: String(formData.get("supplierId") || existing.supplierId),
      txnType,
      status,
      subtotal: amount,
      taxAmount,
      totalAmount: amount + taxAmount,
      notes: (formData.get("notes") as string) || null,
      receivedDate: status === "RECEIVED" ? existing.receivedDate ?? new Date() : null,
      items: {
        create: [
          {
            productId,
            description,
            metal,
            purity,
            weightGrams: weight,
            quantity,
            rate,
            amount,
          },
        ],
      },
    },
    include: { items: true },
  });

  if (status === "RECEIVED") {
    await applyPurchaseReceipt(po);
    await postPurchaseJournal(po);
  }

  revalidatePath("/purchases");
  revalidatePath(`/purchases/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/materials");
  revalidatePath("/accounting");
  redirect(`/purchases/${id}`);
}

export async function deletePurchaseOrder(formData: FormData) {
  const id = String(formData.get("id"));
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!po) return;

  if (po.status === "RECEIVED") {
    await reversePurchaseReceipt(po);
    await deleteJournalBySource("PURCHASE", id);
  }

  await prisma.purchaseOrder.delete({ where: { id } });

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/materials");
  revalidatePath("/accounting");
  redirect("/purchases");
}

export async function createSale(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES"]);
  const txnType = String(formData.get("txnType") || "GOLD_SALE");
  const isReturn = txnType.endsWith("_RETURN");
  const discount = Number(formData.get("discount") || 0);
  const metalRateFallback = Number(formData.get("metalRate") || 0);
  const settings = await prisma.shopSettings.findFirst();
  const taxRaw = formData.get("taxPct");
  const taxPct =
    taxRaw !== null && String(taxRaw).trim() !== ""
      ? Number(taxRaw)
      : (settings?.taxPct ?? 3);

  const incoming = parseSaleItems(formData, metalRateFallback);
  if (incoming.length === 0) {
    throw new Error("Add at least one item to the sale list.");
  }
  await assertSaleItemsMatchScope(txnType, incoming);

  const { lineRows, subtotal, makingCharges } = buildSaleLineRows(
    incoming,
    metalRateFallback
  );
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = (taxable * taxPct) / 100;
  const totalAmount = taxable + taxAmount;
  const invoiceNumber = await nextInvoiceNumber();
  const baseCurrency = settings?.currency || "INR";
  const { payments, paidAmount, paymentMethod } = parseSalePayments(
    formData,
    totalAmount,
    baseCurrency
  );
  const { customerId, customerName } = await resolveSaleCustomer(formData);

  const sale = await prisma.sale.create({
    data: {
      invoiceNumber,
      customerId,
      customerName,
      employeeId: (formData.get("employeeId") as string) || null,
      txnType,
      status: isReturn ? "RETURNED" : "COMPLETED",
      subtotal,
      makingCharges,
      taxAmount,
      discount,
      totalAmount,
      paidAmount,
      paymentMethod,
      notes: (formData.get("notes") as string) || null,
      items: {
        create: lineRows.map((row) => ({
          productId: row.productId,
          inventoryItemId: row.inventoryItemId || null,
          description: row.description,
          metal: row.metal,
          purity: row.purity,
          netWeight: row.netWeight,
          quantity: row.quantity,
          metalRate: row.metalRate,
          makingCharge: row.makingCharge,
          stoneCharge: row.stoneCharge,
          amount: row.amount,
        })),
      },
      payments: {
        create: payments.map((p) => ({
          method: p.method!,
          amount: p.amount!,
          currency: p.currency || baseCurrency,
          foreignAmount: p.foreignAmount ?? p.amount!,
          exchangeRate: p.exchangeRate ?? 1,
          reference: p.reference,
        })),
      },
    },
    include: { payments: true },
  });

  await applySaleStock(lineRows, isReturn);
  await markSerialsSold(lineRows, isReturn);
  await postSaleJournal(sale);
  if (!isReturn) {
    await accrueSaleCommission(sale.id, sale.employeeId, sale.totalAmount);
  }

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/inventory/serials");
  revalidatePath("/commissions");
  revalidatePath("/accounting");
  revalidatePath("/");
  redirect(`/sales/${sale.id}`);
}

export async function updateSale(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES"]);
  const id = String(formData.get("id"));
  const existing = await prisma.sale.findUnique({
    where: { id },
    include: { items: true, payments: true },
  });
  if (!existing) throw new Error("Sale not found");

  const oldIsReturn = existing.txnType.endsWith("_RETURN");
  await applySaleStock(
    existing.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    oldIsReturn,
    true
  );
  await markSerialsSold(
    existing.items.map((i) => ({ inventoryItemId: i.inventoryItemId })),
    true
  );
  await deleteJournalBySource("SALE", id);
  await accrueSaleCommission(id, null, 0, true);

  const txnType = String(formData.get("txnType") || existing.txnType);
  const isReturn = txnType.endsWith("_RETURN");
  const discount = Number(formData.get("discount") || 0);
  const metalRateFallback = Number(formData.get("metalRate") || 0);
  const settingsRow = await prisma.shopSettings.findFirst();
  const taxRaw = formData.get("taxPct");
  const taxPct =
    taxRaw !== null && String(taxRaw).trim() !== ""
      ? Number(taxRaw)
      : (settingsRow?.taxPct ?? 3);
  const incoming = parseSaleItems(formData, metalRateFallback);
  if (incoming.length === 0) throw new Error("Add at least one item to the sale list.");
  await assertSaleItemsMatchScope(txnType, incoming);

  const { lineRows, subtotal, makingCharges } = buildSaleLineRows(
    incoming,
    metalRateFallback
  );
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = (taxable * taxPct) / 100;
  const totalAmount = taxable + taxAmount;
  const baseCurrency = settingsRow?.currency || "INR";
  const { payments, paidAmount, paymentMethod } = parseSalePayments(
    formData,
    totalAmount,
    baseCurrency
  );
  const { customerId, customerName } = await resolveSaleCustomer(formData);

  await prisma.saleItem.deleteMany({ where: { saleId: id } });
  await prisma.salePayment.deleteMany({ where: { saleId: id } });

  const sale = await prisma.sale.update({
    where: { id },
    data: {
      customerId,
      customerName,
      employeeId: (formData.get("employeeId") as string) || null,
      txnType,
      status: isReturn ? "RETURNED" : "COMPLETED",
      subtotal,
      makingCharges,
      taxAmount,
      discount,
      totalAmount,
      paidAmount,
      paymentMethod,
      notes: (formData.get("notes") as string) || null,
      items: {
        create: lineRows.map((row) => ({
          productId: row.productId,
          inventoryItemId: row.inventoryItemId || null,
          description: row.description,
          metal: row.metal,
          purity: row.purity,
          netWeight: row.netWeight,
          quantity: row.quantity,
          metalRate: row.metalRate,
          makingCharge: row.makingCharge,
          stoneCharge: row.stoneCharge,
          amount: row.amount,
        })),
      },
      payments: {
        create: payments.map((p) => ({
          method: p.method!,
          amount: p.amount!,
          currency: p.currency || baseCurrency,
          foreignAmount: p.foreignAmount ?? p.amount!,
          exchangeRate: p.exchangeRate ?? 1,
          reference: p.reference,
        })),
      },
    },
    include: { payments: true },
  });

  await applySaleStock(lineRows, isReturn);
  await markSerialsSold(lineRows, isReturn);
  await postSaleJournal(sale);
  if (!isReturn) {
    await accrueSaleCommission(sale.id, sale.employeeId, sale.totalAmount);
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/inventory/serials");
  revalidatePath("/commissions");
  revalidatePath("/accounting");
  revalidatePath("/");
  redirect(`/sales/${id}`);
}

export async function deleteSale(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES"]);
  const id = String(formData.get("id"));
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true, payments: true },
  });
  if (!sale) return;

  const isReturn = sale.txnType.endsWith("_RETURN");
  await applySaleStock(
    sale.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    isReturn,
    true
  );
  await markSerialsSold(
    sale.items.map((i) => ({ inventoryItemId: i.inventoryItemId })),
    true
  );
  await accrueSaleCommission(id, null, 0, true);
  await deleteJournalBySource("SALE", id);
  await deleteJournalsBySourceIds(
    "SALE_PAYMENT",
    sale.payments.map((p) => p.id)
  );
  await prisma.sale.delete({ where: { id } });

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/inventory/serials");
  revalidatePath("/commissions");
  revalidatePath("/accounting");
  revalidatePath("/");
  redirect("/sales");
}

export async function createManualJournal(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "ACCOUNTANT"]);
  const debitCode = String(formData.get("debitCode"));
  const creditCode = String(formData.get("creditCode"));
  const amount = Number(formData.get("amount"));
  const narration = String(formData.get("narration"));
  const entryDate = formData.get("entryDate")
    ? new Date(String(formData.get("entryDate")))
    : new Date();

  await postJournal({
    entryDate,
    narration,
    sourceType: "MANUAL",
    lines: [
      { code: debitCode, debit: amount },
      { code: creditCode, credit: amount },
    ],
  });

  revalidatePath("/accounting");
  revalidatePath("/accounting/day-book");
  revalidatePath("/accounting/trial-balance");
}

export async function updateSettings(formData: FormData) {
  await requireOwnerOrManager();
  const existing = await prisma.shopSettings.findFirst();
  const clearLogo = formData.get("clearLogo") === "1";
  const logoFile = formData.get("logo") as File | null;
  let logoUrl: string | null | undefined = undefined;

  if (clearLogo) {
    logoUrl = null;
  } else if (logoFile && logoFile.size > 0) {
    const { saveCompanyLogo } = await import("@/lib/products");
    logoUrl = await saveCompanyLogo(logoFile);
  }

  const data = {
    shopName: String(formData.get("shopName") || "Avenue JOAILLERIE").trim(),
    address: (formData.get("address") as string)?.trim() || null,
    phone: (formData.get("phone") as string)?.trim() || null,
    email: (formData.get("email") as string)?.trim() || null,
    gstin: (formData.get("gstin") as string)?.trim() || null,
    currency: String(formData.get("currency") || "INR").trim().toUpperCase() || "INR",
    makingChargePct: Number(formData.get("makingChargePct") || 12),
    wastagePct: Number(formData.get("wastagePct") || 2),
    taxPct: Number(formData.get("taxPct") || 3),
    commissionPct: Number(formData.get("commissionPct") || 1),
    dualAuthAdjustments: formData.get("dualAuthAdjustments") !== "0",
    dualAuthTransfers: formData.get("dualAuthTransfers") !== "0",
    ...(logoUrl !== undefined ? { logoUrl } : {}),
  };
  if (existing) {
    await prisma.shopSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.shopSettings.create({ data });
  }
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/sales");
  revalidatePath("/purchases");
  revalidatePath("/accounting");
}

const staffSchema = z.object({
  name: z.string().trim().min(1),
  role: z.enum(["OWNER", "MANAGER", "SALES", "ACCOUNTANT", "WORKSHOP"]),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  username: z.string().trim().min(2).optional().nullable(),
  password: z.string().min(6).optional().nullable(),
  active: z.boolean().optional(),
  commissionPct: z.number().optional().nullable(),
});

export async function createStaff(formData: FormData) {
  await requireOwnerOrManager();
  const usernameRaw = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const commissionRaw = String(formData.get("commissionPct") || "").trim();
  const parsed = staffSchema.parse({
    name: String(formData.get("name") || ""),
    role: String(formData.get("role") || "SALES"),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    username: usernameRaw || null,
    password: password || null,
    active: formData.get("active") !== "0",
    commissionPct: commissionRaw === "" ? null : Number(commissionRaw),
  });

  if (parsed.username && !parsed.password) {
    throw new Error("Password required when setting a username.");
  }
  if (parsed.username) {
    const taken = await prisma.employee.findFirst({ where: { username: parsed.username } });
    if (taken) throw new Error("Username already taken.");
  }

  await prisma.employee.create({
    data: {
      name: parsed.name,
      role: parsed.role,
      phone: parsed.phone || null,
      email: parsed.email || null,
      username: parsed.username || null,
      passwordHash: parsed.password ? await bcrypt.hash(parsed.password, 10) : null,
      active: parsed.active ?? true,
      commissionPct: parsed.commissionPct,
    },
  });
  revalidatePath("/staff");
}

export async function updateStaff(formData: FormData) {
  await requireOwnerOrManager();
  const id = String(formData.get("id") || "");
  const usernameRaw = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const commissionRaw = String(formData.get("commissionPct") || "").trim();
  const parsed = staffSchema.parse({
    name: String(formData.get("name") || ""),
    role: String(formData.get("role") || "SALES"),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    username: usernameRaw || null,
    password: password || null,
    active: formData.get("active") === "1" || formData.get("active") === "on",
    commissionPct: commissionRaw === "" ? null : Number(commissionRaw),
  });

  if (parsed.username) {
    const taken = await prisma.employee.findFirst({
      where: { username: parsed.username, NOT: { id } },
    });
    if (taken) throw new Error("Username already taken.");
  }

  await prisma.employee.update({
    where: { id },
    data: {
      name: parsed.name,
      role: parsed.role,
      phone: parsed.phone || null,
      email: parsed.email || null,
      username: parsed.username || null,
      active: formData.get("active") === "1" || formData.get("active") === "on",
      commissionPct: parsed.commissionPct,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });
  revalidatePath("/staff");
}

export async function toggleStaffActive(formData: FormData) {
  await requireOwnerOrManager();
  const id = String(formData.get("id") || "");
  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return;
  await prisma.employee.update({
    where: { id },
    data: { active: !emp.active },
  });
  revalidatePath("/staff");
}
