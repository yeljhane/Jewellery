"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
