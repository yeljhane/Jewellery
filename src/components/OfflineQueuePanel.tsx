"use client";

import { useCallback, useEffect, useState } from "react";
import { OFFLINE_QUEUE_EVENT, readOfflineQueue, syncOfflineTransaction, type LocalOfflineSale } from "@/lib/offline-pos-client";
import { Badge, Button, EmptyState } from "@/components/ui";

function cartSummary(sale: LocalOfflineSale) {
  try {
    const items = JSON.parse(sale.fields.itemsJson || "[]") as Array<{ description?: string; quantity?: number }>;
    return items.map((item) => `${item.quantity || 1}× ${item.description || "Item"}`).join(", ") || "Empty cart";
  } catch {
    return "Unreadable cart";
  }
}

export function OfflineQueuePanel() {
  const [queue, setQueue] = useState<LocalOfflineSale[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const refresh = useCallback(() => setQueue(readOfflineQueue()), []);

  useEffect(() => {
    refresh();
    setOnline(navigator.onLine);
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [refresh]);

  if (queue.length === 0) {
    return <EmptyState title="Local queue is clear" description="Offline sales stored on this device will appear here until synchronized." />;
  }

  return (
    <div className="space-y-3">
      {queue.map((sale) => (
        <article key={sale.clientTxnId} className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><p className="font-medium">{sale.fields.customerName || "Walk-in sale"}</p><Badge tone={sale.status === "CONFLICT" ? "danger" : sale.status === "FAILED" ? "warn" : "info"}>{sale.status}</Badge></div>
              <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{cartSummary(sale)}</p>
              <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{sale.clientTxnId}</p>
              {sale.message ? <p className="mt-2 whitespace-pre-line text-xs text-rose-700">{sale.message}</p> : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!online || workingId === sale.clientTxnId}
              onClick={async () => {
                setWorkingId(sale.clientTxnId);
                await syncOfflineTransaction(sale.clientTxnId);
                refresh();
                setWorkingId(null);
              }}
            >
              {workingId === sale.clientTxnId ? "Synchronizing…" : "Retry sync"}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
