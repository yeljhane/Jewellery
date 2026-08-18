"use client";

import { useFormStatus } from "react-dom";

export function SendCampaignButton({
  recipientCount,
  retry = false,
  disabled = false,
}: {
  recipientCount: number;
  retry?: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      onClick={(event) => {
        if (
          !window.confirm(
            `Send this email separately to ${recipientCount} eligible customer${recipientCount === 1 ? "" : "s"}?`
          )
        ) {
          event.preventDefault();
        }
      }}
      className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--gold)] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Sending…" : retry ? "Retry email" : "Send email"}
    </button>
  );
}
