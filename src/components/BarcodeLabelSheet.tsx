"use client";

import { BarcodeSvg } from "@/components/BarcodeSvg";
import type { LabelProduct } from "@/lib/barcodes";
import { formatWeight } from "@/lib/utils";

export function BarcodeLabelSheet({ products }: { products: LabelProduct[] }) {
  return (
    <div className="barcode-sheet">
      {products.map((p) => (
        <div key={p.id} className="barcode-label">
          <p className="barcode-label-name">{p.name}</p>
          <p className="barcode-label-meta">
            {[p.metal, p.purity].filter(Boolean).join(" ")}
            {p.netWeight > 0 ? ` · ${formatWeight(p.netWeight)}` : ""}
          </p>
          <BarcodeSvg sku={p.sku} height={40} className="barcode-label-svg" />
        </div>
      ))}
    </div>
  );
}
