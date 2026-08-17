"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

export function CompanyLogoField({
  currentLogoUrl,
}: {
  currentLogoUrl?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [keepExisting, setKeepExisting] = useState(true);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview || (keepExisting ? currentLogoUrl : null);

  return (
    <div className="md:col-span-2 grid gap-4 md:grid-cols-[1fr_auto]">
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">Company logo</span>
          <input
            type="file"
            name="logo"
            accept="image/*"
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--gold-deep)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
              if (file) {
                setPreview(URL.createObjectURL(file));
                setKeepExisting(true);
              } else {
                setPreview(null);
              }
            }}
          />
        </label>
        <p className="text-[11px] text-[var(--muted)]">
          PNG, JPG, WebP or SVG · max 4MB. Shown on invoices and printed reports.
        </p>
        {currentLogoUrl ? (
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              name="clearLogo"
              value="1"
              onChange={(e) => {
                setKeepExisting(!e.target.checked);
                if (e.target.checked) {
                  if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
                  setPreview(null);
                }
              }}
            />
            Remove current logo
          </label>
        ) : null}
        <input type="hidden" name="existingLogoUrl" value={currentLogoUrl ?? ""} />
      </div>

      <div className="flex h-28 w-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-stone-50/80 p-2">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Company logo preview" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-[var(--muted)]">
            <ImageIcon className="h-6 w-6 opacity-50" />
            <span className="text-[10px]">No logo</span>
          </div>
        )}
      </div>
    </div>
  );
}
