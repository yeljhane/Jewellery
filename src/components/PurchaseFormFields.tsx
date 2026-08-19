"use client";

import { useMemo, useState } from "react";
import {
  PURCHASE_TXN_TYPES,
  isFinishedStockPurchase,
  purchaseJewelleryType,
} from "@/lib/txn-types";
import { isDiamondProduct } from "@/lib/product-helpers";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import {
  PurchaseProductPicker,
  type PurchaseProductOption,
} from "@/components/PurchaseProductPicker";

export function PurchaseFormFields({
  suppliers,
  products,
  action,
  defaults,
  submitLabel = "Create Purchase Order",
}: {
  suppliers: Array<{ id: string; name: string }>;
  products: PurchaseProductOption[];
  action: (formData: FormData) => void | Promise<void>;
  defaults?: {
    id?: string;
    txnType?: string;
    supplierId?: string;
    status?: string;
    description?: string;
    metal?: string;
    purity?: string;
    weightGrams?: number;
    quantity?: number;
    rate?: number;
    notes?: string;
    productId?: string | null;
  };
  submitLabel?: string;
}) {
  const [txnType, setTxnType] = useState(
    defaults?.txnType || "FINISHED_GOLD_PURCHASE"
  );
  const finished = isFinishedStockPurchase(txnType);
  const jewelleryType = purchaseJewelleryType(txnType);

  const filteredProducts = useMemo(() => {
    if (!finished) return products;
    return products.filter((p) => {
      const diamond = isDiamondProduct(p);
      return jewelleryType === "DIAMOND" ? diamond : !diamond;
    });
  }, [products, finished, jewelleryType]);

  return (
    <ActionForm action={action} successMessage="The purchase order was added successfully." className="grid gap-4 md:grid-cols-2">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <Select
        label="Purchase Category"
        name="txnType"
        value={txnType}
        onChange={(e) => setTxnType(e.target.value)}
        required
      >
        {PURCHASE_TXN_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </Select>

      <Select
        label="Supplier"
        name="supplierId"
        required
        defaultValue={defaults?.supplierId || suppliers[0]?.id}
      >
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

      <Select label="Status" name="status" defaultValue={defaults?.status || "RECEIVED"}>
        <option value="DRAFT">Draft</option>
        <option value="ORDERED">Ordered</option>
        <option value="RECEIVED">Received (add to stock now)</option>
        <option value="CANCELLED">Cancelled</option>
      </Select>

      {finished ? (
        <>
          <PurchaseProductPicker
            key={`${txnType}-${jewelleryType}`}
            products={filteredProducts}
            defaultProductId={
              filteredProducts.some((p) => p.id === defaults?.productId)
                ? defaults?.productId ?? ""
                : ""
            }
            jewelleryType={jewelleryType}
          />
          <Input
            label="Quantity to add"
            name="quantity"
            type="number"
            step="1"
            min={1}
            defaultValue={defaults?.quantity ?? 1}
            required
          />
          <Input
            label="Unit cost / rate"
            name="rate"
            type="number"
            step="0.01"
            defaultValue={defaults?.rate ?? 0}
            required
          />
          <input type="hidden" name="description" value={defaults?.description || "Finished stock"} />
          <input type="hidden" name="weightGrams" value="0" />
          <input type="hidden" name="metal" value="" />
          <input type="hidden" name="purity" value="" />
        </>
      ) : (
        <>
          <Input
            label="Description"
            name="description"
            placeholder="22K Gold Bar 100g"
            defaultValue={defaults?.description ?? ""}
            required
          />
          <Select label="Metal" name="metal" defaultValue={defaults?.metal ?? "GOLD"}>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="PLATINUM">Platinum</option>
          </Select>
          <Input label="Purity" name="purity" placeholder="22K" defaultValue={defaults?.purity ?? ""} />
          <Input
            label="Weight (g)"
            name="weightGrams"
            type="number"
            step="0.001"
            defaultValue={defaults?.weightGrams ?? 0}
          />
          <Input
            label="Quantity"
            name="quantity"
            type="number"
            step="0.001"
            defaultValue={defaults?.quantity ?? 1}
          />
          <Input
            label="Rate"
            name="rate"
            type="number"
            step="0.01"
            defaultValue={defaults?.rate ?? 0}
            required
          />
        </>
      )}

      <div className="md:col-span-2">
        <Textarea label="Notes" name="notes" rows={2} defaultValue={defaults?.notes ?? ""} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </ActionForm>
  );
}
