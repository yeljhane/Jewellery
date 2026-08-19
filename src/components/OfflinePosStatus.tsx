"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { OFFLINE_QUEUE_EVENT, readOfflineQueue, syncOfflineQueue } from "@/lib/offline-pos-client";

export function OfflinePosStatus({ serverConflictCount = 0 }: { serverConflictCount?: number }) {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    setOnline(navigator.onLine);
    setQueued(readOfflineQueue().length);
  }, []);

  const synchronize = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    await syncOfflineQueue();
    refresh();
    setSyncing(false);
  }, [refresh]);

  useEffect(() => {
    refresh();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/offline-pos-sw.js").catch(() => undefined);
    const handleOnline = () => { refresh(); void synchronize(); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", refresh);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    const timer = window.setInterval(() => { if (navigator.onLine) void synchronize(); }, 15000);
    if (navigator.onLine) void synchronize();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", refresh);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [refresh, synchronize]);

  return (
    <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${online ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <div className="flex items-center gap-2">
        {online ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
        <span>{online ? "Online — queued sales synchronize automatically" : "Offline — completed sales will be queued on this device"}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>{queued} local queued</span>
        {serverConflictCount > 0 ? <span className="font-semibold text-rose-700">{serverConflictCount} conflicts</span> : null}
        <button type="button" onClick={() => void synchronize()} disabled={!online || syncing} className="inline-flex items-center gap-1 rounded-lg border border-current/20 px-2.5 py-1.5 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync now
        </button>
        <Link href="/pos/offline" className="font-medium underline underline-offset-2">Queue & conflicts</Link>
      </div>
    </div>
  );
}
