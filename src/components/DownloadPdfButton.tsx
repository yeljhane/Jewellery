"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

export function DownloadPdfButton({
  targetSelector = ".invoice-sheet",
  filename = "invoice.pdf",
  label = "Download PDF",
}: {
  targetSelector?: string;
  filename?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    const el = document.querySelector(targetSelector) as HTMLElement | null;
    if (!el) {
      window.alert("Invoice content not found.");
      return;
    }
    setPending(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }

      pdf.save(filename);
    } catch (err) {
      console.error(err);
      window.alert("Could not generate PDF. Try Print instead.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="no-print inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
    >
      <FileDown className="h-4 w-4" />
      {pending ? "Preparing…" : label}
    </button>
  );
}
