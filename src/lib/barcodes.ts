/** Barcode value for jewellery stock = SKU (CODE128). */
export function barcodeValue(sku: string): string {
  return sku.trim();
}

export type LabelProduct = {
  id: string;
  sku: string;
  name: string;
  metal: string;
  purity: string | null;
  netWeight: number;
  jewelleryType?: string | null;
};
