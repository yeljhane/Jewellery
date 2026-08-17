"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrManager, requireRole } from "@/lib/auth";
import {
  nextAppraisalNumber,
  nextRepairNumber,
  nextSerialNumber,
} from "@/lib/data";

export async function createInventorySerial(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const productId = String(formData.get("productId") || "");
  if (!productId) throw new Error("Product is required.");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found.");

  const serialRaw = String(formData.get("serialNumber") || "").trim();
  const serialNumber = serialRaw || (await nextSerialNumber());
  const qty = Math.max(1, Math.floor(Number(formData.get("quantity") || 1)));

  for (let i = 0; i < qty; i++) {
    const sn = qty === 1 ? serialNumber : `${serialNumber}-${i + 1}`;
    await prisma.inventoryItem.create({
      data: {
        serialNumber: sn,
        productId,
        status: "IN_STOCK",
        locationNote: String(formData.get("locationNote") || "").trim() || null,
        costPrice: Number(formData.get("costPrice") || product.costPrice || 0) || null,
        notes: String(formData.get("notes") || "").trim() || null,
      },
    });
  }

  const serialCount = await prisma.inventoryItem.count({
    where: { productId, status: "IN_STOCK" },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      quantity: Math.max(product.quantity, serialCount),
      status: "IN_STOCK",
    },
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/serials");
}

export async function createRepairOrder(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES"]);
  const ticketNumber = await nextRepairNumber();
  const customerId = String(formData.get("customerId") || "").trim() || null;
  const customerName = String(formData.get("customerName") || "").trim() || null;
  const inventoryItemId = String(formData.get("inventoryItemId") || "").trim() || null;
  const estimatedCost = Number(formData.get("estimatedCost") || 0);
  const depositAmount = Number(formData.get("depositAmount") || 0);

  const repair = await prisma.repairOrder.create({
    data: {
      ticketNumber,
      customerId,
      customerName,
      productId: String(formData.get("productId") || "").trim() || null,
      inventoryItemId,
      repairType: String(formData.get("repairType") || "REPAIR"),
      description: String(formData.get("description") || "").trim() || "Repair",
      estimatedCost,
      depositAmount,
      totalCharge: estimatedCost,
      dueDate: formData.get("dueDate")
        ? new Date(String(formData.get("dueDate")))
        : null,
      notes: String(formData.get("notes") || "").trim() || null,
      status: "RECEIVED",
    },
  });

  if (inventoryItemId) {
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { status: "IN_REPAIR" },
    });
  }

  revalidatePath("/repairs");
  redirect(`/repairs/${repair.id}`);
}

export async function updateRepairStatus(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const labourCost = Number(formData.get("labourCost") || 0);
  const materialCost = Number(formData.get("materialCost") || 0);
  const repair = await prisma.repairOrder.findUnique({ where: { id } });
  if (!repair) throw new Error("Repair not found.");

  const totalCharge =
    labourCost > 0 || materialCost > 0
      ? labourCost + materialCost
      : repair.totalCharge || repair.estimatedCost;

  await prisma.repairOrder.update({
    where: { id },
    data: {
      status,
      labourCost: labourCost || repair.labourCost,
      materialCost: materialCost || repair.materialCost,
      totalCharge,
      completedAt:
        status === "READY" || status === "DELIVERED" ? new Date() : repair.completedAt,
    },
  });

  if (repair.inventoryItemId && (status === "READY" || status === "DELIVERED")) {
    await prisma.inventoryItem.update({
      where: { id: repair.inventoryItemId },
      data: { status: status === "DELIVERED" ? "IN_STOCK" : "IN_REPAIR" },
    });
  }

  revalidatePath("/repairs");
  revalidatePath(`/repairs/${id}`);
}

export async function createAppraisal(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES"]);
  const appraisalNumber = await nextAppraisalNumber();
  await prisma.appraisal.create({
    data: {
      appraisalNumber,
      customerId: String(formData.get("customerId") || "").trim() || null,
      customerName: String(formData.get("customerName") || "").trim() || null,
      productId: String(formData.get("productId") || "").trim() || null,
      description: String(formData.get("description") || "").trim() || "Appraisal",
      metal: String(formData.get("metal") || "").trim() || null,
      purity: String(formData.get("purity") || "").trim() || null,
      netWeight: Number(formData.get("netWeight") || 0),
      appraisedValue: Number(formData.get("appraisedValue") || 0),
      purpose: String(formData.get("purpose") || "INSURANCE"),
      notes: String(formData.get("notes") || "").trim() || null,
    },
  });
  revalidatePath("/appraisals");
  redirect("/appraisals");
}

export async function createTradeIn(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES"]);
  const creditAmount = Number(formData.get("creditAmount") || 0);
  if (creditAmount <= 0) throw new Error("Trade-in credit must be positive.");

  await prisma.tradeIn.create({
    data: {
      customerId: String(formData.get("customerId") || "").trim() || null,
      customerName: String(formData.get("customerName") || "").trim() || null,
      saleId: String(formData.get("saleId") || "").trim() || null,
      productId: String(formData.get("productId") || "").trim() || null,
      description: String(formData.get("description") || "").trim() || "Trade-in",
      metal: String(formData.get("metal") || "").trim() || null,
      purity: String(formData.get("purity") || "").trim() || null,
      netWeight: Number(formData.get("netWeight") || 0),
      creditAmount,
      status: formData.get("saleId") ? "APPLIED" : "RECEIVED",
      notes: String(formData.get("notes") || "").trim() || null,
    },
  });

  const saleId = String(formData.get("saleId") || "").trim();
  if (saleId) {
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (sale) {
      const settings = await prisma.shopSettings.findFirst();
      const baseCurrency = settings?.currency || "INR";
      await prisma.salePayment.create({
        data: {
          saleId,
          method: "TRADE_IN",
          amount: creditAmount,
          currency: baseCurrency,
          foreignAmount: creditAmount,
          exchangeRate: 1,
          reference: "Trade-in credit",
        },
      });
      const paidAmount = sale.paidAmount + creditAmount;
      await prisma.sale.update({
        where: { id: saleId },
        data: {
          paidAmount,
          paymentMethod: "MIXED",
        },
      });
    }
  }

  revalidatePath("/appraisals");
  revalidatePath("/sales");
  redirect("/appraisals?tab=tradeins");
}

export async function markCommissionPaid(formData: FormData) {
  await requireOwnerOrManager();
  const id = String(formData.get("id") || "");
  await prisma.commissionEntry.update({
    where: { id },
    data: { status: "PAID" },
  });
  revalidatePath("/commissions");
}

export async function createMarketingCampaign(formData: FormData) {
  await requireOwnerOrManager();
  await prisma.marketingCampaign.create({
    data: {
      name: String(formData.get("name") || "").trim() || "Campaign",
      channel: String(formData.get("channel") || "EMAIL"),
      subject: String(formData.get("subject") || "").trim() || null,
      body: String(formData.get("body") || "").trim() || "",
      audience: String(formData.get("audience") || "ALL"),
      status: "DRAFT",
    },
  });
  revalidatePath("/marketing");
}

export async function sendMarketingCampaign(formData: FormData) {
  await requireOwnerOrManager();
  const id = String(formData.get("id") || "");
  const campaign = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!campaign) throw new Error("Campaign not found.");

  const where =
    campaign.audience === "VIP"
      ? { vipTier: { not: "STANDARD" }, marketingOptIn: true }
      : { marketingOptIn: true };

  const recipients = await prisma.customer.findMany({
    where,
    select: { id: true, email: true, phone: true },
  });

  const sentCount =
    campaign.channel === "EMAIL"
      ? recipients.filter((r) => r.email).length
      : recipients.filter((r) => r.phone).length;

  await prisma.marketingCampaign.update({
    where: { id },
    data: {
      status: "SENT",
      sentCount,
      sentAt: new Date(),
    },
  });

  revalidatePath("/marketing");
}
