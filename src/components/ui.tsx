import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] p-5",
        accent
          ? "bg-[linear-gradient(135deg,var(--gold-deep),var(--gold))] text-white"
          : "bg-[var(--surface)]"
      )}
    >
      <p
        className={cn(
          "text-xs uppercase tracking-[0.14em]",
          accent ? "text-white/70" : "text-[var(--muted)]"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-[family-name:var(--font-display)] text-2xl",
          accent ? "text-white" : "text-[var(--ink)]"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className={cn("mt-1 text-xs", accent ? "text-white/70" : "text-[var(--muted)]")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Card({
  children,
  className,
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)]",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          {title ? (
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warn" | "danger" | "info" | "gold";
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700",
    success: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
    danger: "bg-rose-50 text-rose-800",
    info: "bg-sky-50 text-sky-800",
    gold: "bg-[var(--gold)]/15 text-[var(--gold-deep)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary:
      "bg-[var(--gold-deep)] text-white hover:bg-[var(--gold)] shadow-sm",
    secondary:
      "border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-stone-50",
    ghost: "text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--ink)]",
    danger: "bg-rose-700 text-white hover:bg-rose-600",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-xs font-medium text-[var(--muted)]">{label}</span> : null}
      <input
        className={cn(
          "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--gold)]/30 placeholder:text-stone-400 focus:ring-2",
          className
        )}
        {...props}
      />
    </label>
  );
}

export function Select({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-xs font-medium text-[var(--muted)]">{label}</span> : null}
      <select
        className={cn(
          "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--gold)]/30 focus:ring-2",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Textarea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-xs font-medium text-[var(--muted)]">{label}</span> : null}
      <textarea
        className={cn(
          "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--gold)]/30 placeholder:text-stone-400 focus:ring-2",
          className
        )}
        {...props}
      />
    </label>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
      <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">{title}</p>
      {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
    </div>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
            {headers.map((h) => (
              <th key={h} className="px-3 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">{children}</tbody>
      </table>
    </div>
  );
}
