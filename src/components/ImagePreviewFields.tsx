"use client";

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

export function ImagePreviewFields({
  currentImageUrl,
}: {
  currentImageUrl?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [urlPreview, setUrlPreview] = useState(currentImageUrl ?? "");

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown =
    preview || (urlPreview.trim() ? urlPreview.trim() : null) || currentImageUrl || null;

  return (
    <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">Product image</span>
          <input
            type="file"
            name="image"
            accept="image/*"
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--gold-deep)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
              if (file) {
                setPreview(URL.createObjectURL(file));
              } else {
                setPreview(null);
              }
            }}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--muted)]">Or image URL</span>
          <input
            name="imageUrl"
            value={urlPreview}
            onChange={(e) => setUrlPreview(e.target.value)}
            placeholder="/products/solitaire-ring.svg"
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--gold)]/30 placeholder:text-stone-400 focus:ring-2"
          />
        </label>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-stone-50/80 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
          Preview
        </p>
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[var(--ink)]/5">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Product preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
              <ImageIcon className="h-8 w-8 opacity-50" />
              <span className="text-xs">Choose a file or paste a URL</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
