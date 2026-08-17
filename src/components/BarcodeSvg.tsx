"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { barcodeValue } from "@/lib/barcodes";

export function BarcodeSvg({
  sku,
  height = 48,
  displayValue = true,
  className,
}: {
  sku: string;
  height?: number;
  displayValue?: boolean;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const value = barcodeValue(sku);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 1.6,
        height,
        displayValue,
        fontSize: 12,
        margin: 4,
        background: "#ffffff",
        lineColor: "#111111",
      });
    } catch {
      // invalid value — leave empty SVG
    }
  }, [value, height, displayValue]);

  if (!value) return null;
  return <svg ref={ref} className={className} />;
}
