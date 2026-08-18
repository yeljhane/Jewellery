"use client";

import { useMemo, useState, type ComponentProps, type FormEvent } from "react";
import { SALE_TXN_TYPES, saleJewelleryScope } from "@/lib/txn-types";
import { isDiamondProduct } from "@/lib/product-helpers";
import { Button, Select, Textarea } from "@/components/ui";
import { SaleCustomerField } from "@/components/SaleCustomerField";
import {
  SaleProductSearch,
  type SaleProductOption,
} from "@/components/SaleProductSearch";
import { queueOfflineSale, syncOfflineTransaction } from "@/lib/offline-pos-client";

export function SaleFormFields({
  action,
  customers,
  employees,
  products,
  defaultMetalRate = 0,
  baseCurrency = "AZN",
  defaultTaxPct = 3,
  submitLabel = "Complete Sale",
  mode = "full",
  defaults,
  offlineMode = false,
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
  offlineMode?: boolean;
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
  const [formVersion, setFormVersion] = useState(0);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [submittingOffline, setSubmittingOffline] = useState(false);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!offlineMode) return;
    event.preventDefault();
    if (submittingOffline) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    let items: unknown[] = [];
    try {
      items = JSON.parse(String(formData.get("itemsJson") || "[]"));
    } catch {
      items = [];
    }
    if (items.length === 0) {
      setOfflineMessage("Add at least one item before completing the sale.");
      return;
    }

    setSubmittingOffline(true);
    const queued = queueOfflineSale(formData);
    form.reset();
    setTxnType(defaults?.txnType || "RETAIL_SALE");
    setFormVersion((value) => value + 1);
    setOfflineMessage(
      navigator.onLine
        ? "Sale secured locally. Synchronizing…"
        : "Sale saved offline and queued for synchronization."
    );

    if (navigator.onLine) {
      const result = await syncOfflineTransaction(queued.clientTxnId);
      if (result?.status === "SYNCED" && result.saleId) {
        window.location.assign(`/sales/${result.saleId}`);
        return;
      }
      if (result?.status === "CONFLICT") {
        setOfflineMessage(`Synchronization conflict: ${result.message || "Review required."}`);
      } else if (result?.status === "FAILED") {
        setOfflineMessage(`Queued for retry: ${result.message || "Synchronization failed."}`);
      }
    }
    setSubmittingOffline(false);
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
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
        key={`customer-${formVersion}`}
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
        key={`${txnType}-${formVersion}`}
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
        <Button type="submit" disabled={submittingOffline}>
          {submittingOffline ? "Securing sale…" : submitLabel}
        </Button>
        {defaults?.id ? (
          <a
            href={`/sales/${defaults.id}`}
            className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          >
            Cancel
          </a>
        ) : null}
      </div>
      {offlineMessage ? (
        <div
          className={`md:col-span-2 rounded-lg border px-3 py-2 text-sm ${
            offlineMessage.includes("conflict") || offlineMessage.startsWith("Add")
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {offlineMessage}
        </div>
      ) : null}
    </form>
  );
}
