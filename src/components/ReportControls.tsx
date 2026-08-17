import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui";

function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseReportDates(params: {
  from?: string;
  to?: string;
  asOf?: string;
}) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const yearStart = new Date(today.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);

  let from: Date | undefined;
  let to: Date | undefined;

  if (params.from) {
    from = new Date(params.from);
    from.setHours(0, 0, 0, 0);
  }
  if (params.to || params.asOf) {
    to = new Date(params.to || params.asOf!);
    to.setHours(23, 59, 59, 999);
  }

  return {
    from: from ?? yearStart,
    to: to ?? today,
    fromValue: toInputDate(from ?? yearStart),
    toValue: toInputDate(to ?? today),
  };
}

export function formatPeriodLabel(from: Date, to: Date) {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  return `${fmt(from)} — ${fmt(to)}`;
}

export function DateRangeToolbar({
  fromValue,
  toValue,
  mode = "range",
  extraFields,
  preserve,
}: {
  fromValue: string;
  toValue: string;
  mode?: "range" | "asOf";
  extraFields?: React.ReactNode;
  preserve?: Record<string, string | undefined>;
}) {
  return (
    <form className="no-print mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {preserve
        ? Object.entries(preserve).map(([key, value]) =>
            value ? <input key={key} type="hidden" name={key} value={value} /> : null
          )
        : null}
      {mode === "range" ? (
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">From</span>
          <input
            type="date"
            name="from"
            defaultValue={fromValue}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
          />
        </label>
      ) : null}
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--muted)]">
          {mode === "asOf" ? "As of" : "To"}
        </span>
        <input
          type="date"
          name={mode === "asOf" ? "asOf" : "to"}
          defaultValue={toValue}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
        />
      </label>
      {extraFields}
      <Button type="submit" variant="secondary">
        Apply
      </Button>
      <PrintButton />
    </form>
  );
}

export function ReportPrintHeader({
  shopName,
  title,
  subtitle,
  address,
  gstin,
  phone,
  email,
  logoUrl,
}: {
  shopName: string;
  title: string;
  subtitle: string;
  address?: string | null;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
}) {
  const contact = [phone, email].filter(Boolean).join(" · ");
  return (
    <div className="print-header mb-6 border-b border-[var(--border)] pb-4">
      <div className="flex items-start gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={shopName}
            className="company-logo h-16 w-auto max-w-[160px] object-contain"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--gold-deep)]">
            {shopName}
          </p>
          {address ? <p className="text-sm text-[var(--muted)]">{address}</p> : null}
          {contact ? <p className="text-xs text-[var(--muted)]">{contact}</p> : null}
          {gstin ? <p className="text-xs text-[var(--muted)]">Tax No: {gstin}</p> : null}
        </div>
      </div>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
        {title}
      </h1>
      <p className="text-sm text-[var(--muted)]">{subtitle}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Printed{" "}
        {new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date())}
      </p>
    </div>
  );
}
