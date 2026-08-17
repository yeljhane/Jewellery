"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { SALE_TXN_TYPES, saleJewelleryScope } from "@/lib/txn-types";
import { isDiamondProduct } from "@/lib/product-helpers";
import { Button, Select, Textarea } from "@/components/ui";
import { SaleCustomerField } from "@/components/SaleCustomerField";
import {
  SaleProductSearch,
  type SaleProductOption,
} from "@/components/SaleProductSearch";

export function SaleFormFields({
  action,
  customers,
  employees,
  products,
  defaultMetalRate = 0,
  baseCurrency = "INR",
  defaultTaxPct = 3,
  submitLabel = "Complete Sale",
  mode = "full",
  defaults,
}: {
  action: (formData: FormData) => void | Promise<void>;
  customers: Array<{ id: string; name: string; phone: string | null; vipTier?: string | null }>;
  employees: Array<{ id: string; name: string }>;
  products: SaleProductOption[];
  defaultMetalRate?: number;
  baseCurrency?: string;
  defaultTaxPct?: number;
  submitLabel?: string;
  /** POS hides return categories for faster counter billing */
  mode?: "pos" | "full";
  defaults?: {
    id?: string;
    txnType?: string;
    customerId?: string;
    customerName?: string;
    employeeId?: string;
    notes?: string;
    initialDiscount?: number;
    initialTaxPct?: number;
    initialLines?: ComponentProps<typeof SaleProductSearch>["initialLines"];
    initialPayments?: ComponentProps<typeof SaleProductSearch>["initialPayments"];
  };
}) {
  const txnOptions =
    mode === "pos" ? SALE_TXN_TYPES.filter((t) => !t.isReturn) : SALE_TXN_TYPES;

  const [txnType, setTxnType] = useState(defaults?.txnType || "RETAIL_SALE");
  const scope = saleJewelleryScope(txnType);
  const originalTxnType = defaults?.txnType || "RETAIL_SALE";
  const keepInitialCart = txnType === originalTxnType;

  const filteredProducts = useMemo(() => {
    if (scope === "ALL") return products;
    return products.filter((p) => {
      const diamond = isDiamondProduct(p);
      return scope === "DIAMOND" ? diamond : !diamond;
    });
  }, [products, scope]);

  const scopeLabel =
    scope === "DIAMOND" ? "diamond" : scope === "GOLD" ? "gold" : "shop";

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <Select
        label="Sale Category"
        name="txnType"
        value={txnType}
        onChange={(e) => setTxnType(e.target.value)}
        required
      >
        {txnOptions.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </Select>

      <SaleCustomerField
        customers={customers}
        defaultCustomerId={defaults?.customerId ?? ""}
        defaultCustomerName={defaults?.customerName ?? ""}
      />

      <Select
        label="Salesperson"
        name="employeeId"
        defaultValue={defaults?.employeeId ?? ""}
        className="md:col-span-2"
      >
        <option value="">Unassigned</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </Select>

      <p className="md:col-span-2 text-xs text-[var(--muted)]">
        {scope === "ALL"
          ? "Retail shop sales can include any stock item."
          : `Only ${scopeLabel} jewellery items are listed for this sale type.`}
      </p>

      <SaleProductSearch
        key={txnType}
        products={filteredProducts}
        jewelleryScope={scope}
        defaultMetalRate={defaultMetalRate}
        baseCurrency={baseCurrency}
        initialDiscount={keepInitialCart ? defaults?.initialDiscount : undefined}
        initialTaxPct={
          keepInitialCart && defaults?.initialTaxPct != null
            ? defaults.initialTaxPct
            : defaultTaxPct
        }
        initialLines={keepInitialCart ? defaults?.initialLines : undefined}
        initialPayments={keepInitialCart ? defaults?.initialPayments : undefined}
      />

      <div className="md:col-span-2">
        <Textarea label="Notes" name="notes" rows={2} defaultValue={defaults?.notes ?? ""} />
      </div>
      <div className="md:col-span-2 flex flex-wrap gap-2">
        <Button type="submit">{submitLabel}</Button>
        {defaults?.id ? (
          <a
            href={`/sales/${defaults.id}`}
            className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          >
            Cancel
          </a>
        ) : null}
      </div>
    </form>
  );
}
