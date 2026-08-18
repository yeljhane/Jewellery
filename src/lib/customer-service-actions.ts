"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { nextServiceCaseNumber, nextVatRefundNumber } from "@/lib/data";
import { prisma } from "@/lib/prisma";

const CASE_TYPES = ["COMPLAINT", "ENQUIRY", "SERVICE_TICKET"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const CASE_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];

function optionalDate(value: FormDataEntryValue | null) {
  if (!value || !String(value).trim()) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function allowed(value: string, choices: string[], fallback: string) {
  return choices.includes(value) ? value : fallback;
}

export async function createCustomerServiceCase(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER", "SALES"]);
  const subject = String(formData.get("subject") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!subject || !description) throw new Error("Subject and description are required.");

  const customerId = String(formData.get("customerId") || "").trim() || null;
  const customer = customerId
    ? await prisma.customer.findUnique({ where: { id: customerId } })
    : null;
  const priority = allowed(String(formData.get("priority") || "NORMAL"), PRIORITIES, "NORMAL");
  const settings = await prisma.shopSettings.findFirst();
  const slaHours =
    priority === "CRITICAL"
      ? settings?.slaCriticalHours ?? 4
      : priority === "HIGH"
        ? settings?.slaHighHours ?? 8
        : priority === "LOW"
          ? settings?.slaLowHours ?? 72
          : settings?.slaNormalHours ?? 24;
  const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  const serviceCase = await prisma.customerServiceCase.create({
    data: {
      caseNumber: await nextServiceCaseNumber(),
      type: allowed(String(formData.get("type") || "ENQUIRY"), CASE_TYPES, "ENQUIRY"),
      priority,
      channel: String(formData.get("channel") || "IN_PERSON"),
      subject,
      description,
      customerId: customer?.id || null,
      contactName: customer?.name || String(formData.get("contactName") || "").trim() || null,
      contactEmail: customer?.email || String(formData.get("contactEmail") || "").trim() || null,
      contactPhone: customer?.phone || String(formData.get("contactPhone") || "").trim() || null,
      saleId: String(formData.get("saleId") || "").trim() || null,
      assignedToId: String(formData.get("assignedToId") || "").trim() || null,
      createdById: session.user.employeeId || null,
      slaDueAt,
      interactions: {
        create: {
          channel: "NOTE",
          direction: "INTERNAL",
          summary: `Case opened: ${description}`,
          authorId: session.user.employeeId || null,
        },
      },
    },
  });

  revalidatePath("/service");
  redirect(`/service/${serviceCase.id}`);
}

export async function updateCustomerServiceCase(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES"]);
  const id = String(formData.get("id") || "");
  const existing = await prisma.customerServiceCase.findUnique({ where: { id } });
  if (!existing) throw new Error("Customer-service case not found.");

  const status = allowed(String(formData.get("status") || existing.status), CASE_STATUSES, existing.status);
  const now = new Date();
  await prisma.customerServiceCase.update({
    where: { id },
    data: {
      status,
      priority: allowed(String(formData.get("priority") || existing.priority), PRIORITIES, existing.priority),
      assignedToId: String(formData.get("assignedToId") || "").trim() || null,
      resolvedAt: status === "RESOLVED" && !existing.resolvedAt ? now : existing.resolvedAt,
      closedAt: status === "CLOSED" && !existing.closedAt ? now : existing.closedAt,
    },
  });
  revalidatePath("/service");
  revalidatePath(`/service/${id}`);
}

export async function addCaseInteraction(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER", "SALES"]);
  const caseId = String(formData.get("caseId") || "");
  const summary = String(formData.get("summary") || "").trim();
  if (!summary) throw new Error("Interaction summary is required.");
  const serviceCase = await prisma.customerServiceCase.findUnique({ where: { id: caseId } });
  if (!serviceCase) throw new Error("Customer-service case not found.");
  const direction = String(formData.get("direction") || "INTERNAL");

  await prisma.$transaction([
    prisma.caseInteraction.create({
      data: {
        caseId,
        channel: String(formData.get("channel") || "NOTE"),
        direction,
        summary,
        nextFollowUpAt: optionalDate(formData.get("nextFollowUpAt")),
        authorId: session.user.employeeId || null,
      },
    }),
    prisma.customerServiceCase.update({
      where: { id: caseId },
      data: {
        status: serviceCase.status === "OPEN" ? "IN_PROGRESS" : serviceCase.status,
        firstResponseAt:
          direction === "OUTBOUND" && !serviceCase.firstResponseAt ? new Date() : serviceCase.firstResponseAt,
      },
    }),
  ]);
  revalidatePath("/service");
  revalidatePath(`/service/${caseId}`);
}

export async function createTouristVatRefund(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER", "SALES", "ACCOUNTANT"]);
  const saleId = String(formData.get("saleId") || "");
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale || sale.status !== "COMPLETED" || sale.txnType.endsWith("_RETURN")) {
    throw new Error("Select a completed sales invoice.");
  }
  if (sale.taxAmount <= 0) throw new Error("This invoice has no refundable VAT amount.");
  const settings = await prisma.shopSettings.findFirst();
  if (settings?.touristVatRefundEnabled === false) throw new Error("Tourist VAT refunds are disabled in Settings.");
  if (!settings?.taxFreeMerchantRegistered) throw new Error("The shop must be marked as an authorized tax-free merchant in Settings.");
  if (sale.totalAmount <= (settings?.vatRefundMinSale ?? 300)) {
    throw new Error("This invoice is below the configured tourist VAT-refund minimum.");
  }
  const taxableAmount = Math.max(0, sale.subtotal - sale.discount);
  const expectedVat = Math.round(taxableAmount * ((settings?.taxPct ?? 18) / 100) * 100) / 100;
  if (Math.abs(sale.taxAmount - expectedVat) > 0.02) {
    throw new Error("The invoice VAT does not match the currently configured Azerbaijan VAT rate.");
  }
  const existing = await prisma.touristVatRefund.findFirst({
    where: { saleId, status: { not: "REJECTED" } },
  });
  if (existing) throw new Error("An active VAT-refund claim already exists for this invoice.");

  const touristName = String(formData.get("touristName") || "").trim();
  const passportNumber = String(formData.get("passportNumber") || "").trim();
  const nationality = String(formData.get("nationality") || "").trim();
  if (!touristName || !passportNumber || !nationality) {
    throw new Error("Tourist name, passport number, and nationality are required.");
  }
  const eTaxInvoiceNumber = String(formData.get("eTaxInvoiceNumber") || "").trim();
  const departureDate = optionalDate(formData.get("departureDate"));
  const departurePoint = String(formData.get("departurePoint") || "").trim();
  if (!eTaxInvoiceNumber || !departureDate || !departurePoint) {
    throw new Error("Electronic tax invoice, departure date, and airport are required.");
  }
  const daysUntilDeparture = (departureDate.getTime() - sale.saleDate.getTime()) / 86_400_000;
  if (daysUntilDeparture < 0 || daysUntilDeparture > 90) {
    throw new Error("Goods must leave Azerbaijan by air within 90 days of purchase.");
  }
  if (
    formData.get("foreignVisitorConfirmed") !== "1" ||
    formData.get("nonCommercialUseConfirmed") !== "1" ||
    formData.get("eligibleGoodsConfirmed") !== "1"
  ) {
    throw new Error("All tax-free eligibility confirmations are required.");
  }
  const administrationFee = Math.round(sale.taxAmount * (settings.vatRefundFeePct / 100) * 100) / 100;
  const refundableAmount = Math.max(0, Math.min(sale.taxAmount, sale.taxAmount - administrationFee));
  if (refundableAmount <= 0) throw new Error("Administration fee cannot consume the full VAT amount.");

  const refund = await prisma.touristVatRefund.create({
    data: {
      refundNumber: await nextVatRefundNumber(),
      saleId: sale.id,
      customerId: sale.customerId,
      touristName,
      passportNumber,
      nationality,
      eTaxInvoiceNumber,
      departureDate,
      departurePoint,
      departureMethod: "AIR",
      foreignVisitorConfirmed: true,
      nonCommercialUseConfirmed: true,
      eligibleGoodsConfirmed: true,
      invoiceTotal: sale.totalAmount,
      vatAmount: sale.taxAmount,
      administrationFee,
      refundableAmount,
      status: "ELIGIBLE",
      eligibilityNotes: String(formData.get("eligibilityNotes") || "").trim() || null,
      createdById: session.user.employeeId || null,
      events: {
        create: {
          action: "ELIGIBLE",
          note: "Claim created from a completed VAT-bearing sales invoice.",
          actorId: session.user.employeeId || null,
        },
      },
    },
  });
  revalidatePath("/vat-refunds");
  redirect(`/vat-refunds/${refund.id}`);
}

export async function updateTouristVatRefundStatus(formData: FormData) {
  const session = await requireRole(["OWNER", "MANAGER", "SALES", "ACCOUNTANT"]);
  const id = String(formData.get("id") || "");
  const requested = String(formData.get("status") || "");
  const refund = await prisma.touristVatRefund.findUnique({ where: { id } });
  if (!refund) throw new Error("VAT-refund claim not found.");

  const transitions: Record<string, string[]> = {
    DRAFT: ["ELIGIBLE", "REJECTED"],
    ELIGIBLE: ["VALIDATED", "REJECTED"],
    VALIDATED: ["PAID", "REJECTED"],
    PAID: [],
    REJECTED: [],
  };
  if (!transitions[refund.status]?.includes(requested)) {
    throw new Error(`Cannot change ${refund.status} claim to ${requested}.`);
  }
  if (requested === "PAID" && session.user.role === "SALES") {
    throw new Error("Only an owner, manager, or accountant can mark a refund as paid.");
  }
  const validationRef = String(formData.get("validationRef") || "").trim() || null;
  const refundMethod = String(formData.get("refundMethod") || "").trim() || null;
  if (requested === "VALIDATED" && !validationRef) throw new Error("Validation reference is required.");
  if (requested === "PAID" && !refundMethod) throw new Error("Refund method is required.");
  if (requested === "PAID" && !["CARD", "CASH"].includes(refundMethod || "")) {
    throw new Error("Tourist VAT refunds may be paid by card or cash.");
  }

  await prisma.$transaction([
    prisma.touristVatRefund.update({
      where: { id },
      data: {
        status: requested,
        validationRef: validationRef || refund.validationRef,
        refundMethod: refundMethod || refund.refundMethod,
        processedAt: requested === "PAID" ? new Date() : refund.processedAt,
      },
    }),
    prisma.touristVatRefundEvent.create({
      data: {
        refundId: id,
        action: requested,
        note: String(formData.get("note") || "").trim() || null,
        actorId: session.user.employeeId || null,
      },
    }),
  ]);
  revalidatePath("/vat-refunds");
  revalidatePath(`/vat-refunds/${id}`);
}
