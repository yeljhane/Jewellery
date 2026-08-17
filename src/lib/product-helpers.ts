/** Client-safe product helpers (no Node APIs). */

export function isDiamondProduct(p: {
  name: string;
  jewelleryType?: string | null;
  stoneDetails?: string | null;
  category?: { name: string } | null;
}) {
  if (p.jewelleryType === "DIAMOND") return true;
  if (p.jewelleryType === "GOLD") return false;
  const hay = `${p.name} ${p.stoneDetails ?? ""} ${p.category?.name ?? ""}`.toLowerCase();
  return hay.includes("diamond") || hay.includes("solitaire") || hay.includes("brilliant");
}

export function stockSortRank(p: {
  name: string;
  metal: string;
  jewelleryType?: string | null;
  stoneDetails?: string | null;
  stoneWeight?: number;
  category?: { name: string } | null;
}) {
  if (isDiamondProduct(p)) return 0;
  if (p.jewelleryType === "GOLD" || p.metal === "GOLD") return 1;
  if (p.metal === "PLATINUM") return 2;
  if (p.metal === "SILVER") return 3;
  return 4;
}
