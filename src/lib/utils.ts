import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "AZN") {
  const code = (currency || "AZN").toUpperCase();
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

export function formatWeight(grams: number) {
  return `${grams.toFixed(3)} g`;
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function calcJewelleryAmount({
  netWeight,
  metalRate,
  makingCharge,
  stoneCharge = 0,
  wastagePct = 0,
}: {
  netWeight: number;
  metalRate: number;
  makingCharge: number;
  stoneCharge?: number;
  wastagePct?: number;
}) {
  const wastageWeight = (netWeight * wastagePct) / 100;
  const metalValue = (netWeight + wastageWeight) * metalRate;
  return metalValue + makingCharge + stoneCharge;
}

export function generateNumber(prefix: string, seq: number) {
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}${year}${String(seq).padStart(5, "0")}`;
}

export const METALS = ["GOLD", "SILVER", "PLATINUM", "FASHION"] as const;
export const PURITIES = {
  GOLD: ["24K", "22K", "18K", "14K"],
  SILVER: ["999", "925", "900"],
  PLATINUM: ["950", "900"],
  FASHION: ["N/A"],
} as const;

export const JOB_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const SALE_STATUSES = ["DRAFT", "COMPLETED", "CANCELLED", "RETURNED"] as const;
export const PO_STATUSES = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const;
