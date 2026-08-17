export const JEWELLERY_TYPES = [
  { value: "GOLD", label: "Gold Jewellery" },
  { value: "DIAMOND", label: "Diamond Jewellery" },
] as const;

export const SALE_TXN_TYPES = [
  { value: "RETAIL_SALE", label: "Retail Sales (Shop)", jewelleryType: "RETAIL", isReturn: false },
  { value: "RETAIL_RETURN", label: "Retail Sales Return", jewelleryType: "RETAIL", isReturn: true },
  { value: "GOLD_SALE", label: "Gold Sales", jewelleryType: "GOLD", isReturn: false },
  { value: "GOLD_RETURN", label: "Gold Sales Return", jewelleryType: "GOLD", isReturn: true },
  { value: "DIAMOND_SALE", label: "Diamond Sales", jewelleryType: "DIAMOND", isReturn: false },
  { value: "DIAMOND_RETURN", label: "Diamond Sales Return", jewelleryType: "DIAMOND", isReturn: true },
] as const;

export const PURCHASE_TXN_TYPES = [
  { value: "GOLD_PURCHASE", label: "Gold Purchase (Raw)", jewelleryType: "GOLD", isReturn: false, stock: "RAW" },
  { value: "GOLD_RETURN", label: "Gold Purchase Return (Raw)", jewelleryType: "GOLD", isReturn: true, stock: "RAW" },
  { value: "DIAMOND_PURCHASE", label: "Diamond Purchase (Raw)", jewelleryType: "DIAMOND", isReturn: false, stock: "RAW" },
  { value: "DIAMOND_RETURN", label: "Diamond Purchase Return (Raw)", jewelleryType: "DIAMOND", isReturn: true, stock: "RAW" },
  {
    value: "FINISHED_GOLD_PURCHASE",
    label: "Gold Finished Stock Purchase",
    jewelleryType: "GOLD",
    isReturn: false,
    stock: "FINISHED",
  },
  {
    value: "FINISHED_GOLD_RETURN",
    label: "Gold Finished Stock Return",
    jewelleryType: "GOLD",
    isReturn: true,
    stock: "FINISHED",
  },
  {
    value: "FINISHED_DIAMOND_PURCHASE",
    label: "Diamond Finished Stock Purchase",
    jewelleryType: "DIAMOND",
    isReturn: false,
    stock: "FINISHED",
  },
  {
    value: "FINISHED_DIAMOND_RETURN",
    label: "Diamond Finished Stock Return",
    jewelleryType: "DIAMOND",
    isReturn: true,
    stock: "FINISHED",
  },
] as const;

export type SaleTxnType = (typeof SALE_TXN_TYPES)[number]["value"];
export type PurchaseTxnType = (typeof PURCHASE_TXN_TYPES)[number]["value"];

export function saleTxnLabel(value: string) {
  return SALE_TXN_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function purchaseTxnLabel(value: string) {
  if (value === "FINISHED_PURCHASE") return "Finished Stock Purchase";
  if (value === "FINISHED_RETURN") return "Finished Stock Return";
  return PURCHASE_TXN_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function isSaleReturn(txnType: string) {
  const found = SALE_TXN_TYPES.find((t) => t.value === txnType);
  if (found) return found.isReturn;
  return (
    txnType.endsWith("_RETURN") &&
    (txnType.startsWith("GOLD_") ||
      txnType.startsWith("DIAMOND_") ||
      txnType.startsWith("RETAIL_"))
  );
}

/** Which stock items appear in the sale item picker. */
export function saleJewelleryScope(txnType: string): "GOLD" | "DIAMOND" | "ALL" {
  const found = SALE_TXN_TYPES.find((t) => t.value === txnType);
  if (found?.jewelleryType === "RETAIL") return "ALL";
  if (found?.jewelleryType === "DIAMOND") return "DIAMOND";
  if (found?.jewelleryType === "GOLD") return "GOLD";
  if (txnType.startsWith("RETAIL_") || txnType.includes("RETAIL")) return "ALL";
  if (txnType.includes("DIAMOND")) return "DIAMOND";
  return "GOLD";
}

export function isPurchaseReturn(txnType: string) {
  return txnType.endsWith("_RETURN");
}

export function isFinishedStockPurchase(txnType: string) {
  return (
    txnType === "FINISHED_PURCHASE" || // legacy
    txnType === "FINISHED_RETURN" || // legacy
    txnType.startsWith("FINISHED_")
  );
}

export function purchaseJewelleryType(txnType: string): "GOLD" | "DIAMOND" {
  const found = PURCHASE_TXN_TYPES.find((t) => t.value === txnType);
  if (found) return found.jewelleryType;
  if (txnType.includes("DIAMOND")) return "DIAMOND";
  return "GOLD";
}
