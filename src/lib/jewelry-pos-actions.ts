"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrManager, requireRole } from "@/lib/auth";
import { deliverCampaignEmails } from "@/lib/marketing-email";
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
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!subject) throw new Error("Email subject is required.");
  if (!body) throw new Error("Email message is required.");

  const brochure = formData.get("brochure");
  let attachmentUrl: string | null = null;
  let attachmentName: string | null = null;
  let attachmentType: string | null = null;

  if (brochure instanceof File && brochure.size > 0) {
    const allowedTypes: Record<string, string> = {
      "application/pdf": ".pdf",
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };
    const extension = allowedTypes[brochure.type];
    if (!extension) {
      throw new Error("Brochure must be a PDF, JPG, PNG or WebP file.");
    }
    if (brochure.size > 15 * 1024 * 1024) {
      throw new Error("Brochure file is too large. Maximum size is 15 MB.");
    }

    const uploadDirectory = path.join(process.cwd(), "public", "uploads", "marketing");
    await mkdir(uploadDirectory, { recursive: true });
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(path.join(uploadDirectory, storedName), Buffer.from(await brochure.arrayBuffer()));

    attachmentUrl = `/uploads/marketing/${storedName}`;
    attachmentName = path.basename(brochure.name).slice(0, 180) || `brochure${extension}`;
    attachmentType = brochure.type;
  }

  await prisma.marketingCampaign.create({
    data: {
      name: String(formData.get("name") || "").trim() || "Campaign",
      channel: "EMAIL",
      subject,
      body,
      attachmentUrl,
      attachmentName,
      attachmentType,
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
  if (campaign.channel !== "EMAIL") throw new Error("Only email campaigns support live delivery.");
  if (!campaign.subject) throw new Error("Campaign subject is required.");

  const claimed = await prisma.marketingCampaign.updateMany({
    where: {
      id,
      status: { in: ["DRAFT", "FAILED"] },
      sentCount: 0,
    },
    data: { status: "SENDING", failedCount: 0, lastError: null },
  });
  if (claimed.count === 0) {
    revalidatePath("/marketing");
    return;
  }

  const where =
    campaign.audience === "VIP"
      ? { vipTier: { not: "STANDARD" }, marketingOptIn: true }
      : { marketingOptIn: true };

  const recipients = await prisma.customer.findMany({
    where,
    select: { name: true, email: true },
  });
  const emailRecipients = recipients
    .filter((recipient): recipient is { name: string; email: string } =>
      Boolean(recipient.email?.trim() && recipient.email.includes("@"))
    )
    .map((recipient) => ({ name: recipient.name, email: recipient.email.trim() }));

  if (emailRecipients.length === 0) {
    await prisma.marketingCampaign.update({
      where: { id },
      data: {
        status: "FAILED",
        lastError: "No opted-in customers in this audience have a valid email address.",
      },
    });
    revalidatePath("/marketing");
    return;
  }

  try {
    const settings = await prisma.shopSettings.findFirst();
    const result = await deliverCampaignEmails({
      campaign: {
        subject: campaign.subject,
        body: campaign.body,
        attachmentUrl: campaign.attachmentUrl,
        attachmentName: campaign.attachmentName,
        attachmentType: campaign.attachmentType,
      },
      recipients: emailRecipients,
      shopName: settings?.shopName || "Avenue JOAILLERIE",
    });

    const status =
      result.sentCount === emailRecipients.length
        ? "SENT"
        : result.sentCount > 0
          ? "PARTIAL"
          : "FAILED";
    await prisma.marketingCampaign.update({
      where: { id },
      data: {
        status,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        lastError: result.errors.join("\n") || null,
        sentAt: result.sentCount > 0 ? new Date() : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed.";
    await prisma.marketingCampaign.update({
      where: { id },
      data: { status: "FAILED", failedCount: emailRecipients.length, lastError: message },
    });
  }

  revalidatePath("/marketing");
}
