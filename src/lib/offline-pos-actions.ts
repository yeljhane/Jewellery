"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { processOfflineSale, type OfflineSaleEnvelope } from "@/lib/offline-pos-server";
import { prisma } from "@/lib/prisma";

export async function resolveOfflinePosTransaction(formData: FormData) {
  await requireRole(["OWNER", "MANAGER", "SALES"]);
  const id = String(formData.get("id") || "");
  const resolution = String(formData.get("resolution") || "");
  const transaction = await prisma.offlinePosTransaction.findUnique({ where: { id } });
  if (!transaction || !["CONFLICT", "FAILED"].includes(transaction.status)) {
    throw new Error("Offline transaction is not available for resolution.");
  }

  if (resolution === "DISCARD") {
    await prisma.offlinePosTransaction.update({
      where: { id },
      data: { status: "DISCARDED", resolution: "DISCARDED", resolvedAt: new Date() },
    });
  } else if (resolution === "RETRY") {
    const envelope = JSON.parse(transaction.payload) as OfflineSaleEnvelope;
    await processOfflineSale(envelope, true);
  } else {
    throw new Error("Choose retry or discard.");
  }

  revalidatePath("/pos");
  revalidatePath("/pos/offline");
}
