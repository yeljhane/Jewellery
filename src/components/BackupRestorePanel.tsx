"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function BackupRestorePanel() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onRestore(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!window.confirm("Replace the current database with this backup? A .pre-restore.bak copy will be kept.")) {
      return;
    }
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch("/api/backup/restore", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Restore failed");
      } else {
        setMessage(data.message || "Restored.");
      }
    } catch {
      setError("Restore request failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <a
          href="/api/backup"
          className="inline-flex items-center rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
        >
          Download backup (.db)
        </a>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Downloads a copy of the SQLite database. Keep it somewhere safe.
        </p>
      </div>

      <form onSubmit={onRestore} className="space-y-3 border-t border-[var(--border)] pt-4">
        <label className="block text-sm font-medium">Restore from backup</label>
        <input
          type="file"
          name="file"
          accept=".db,application/octet-stream"
          required
          className="block w-full text-sm"
        />
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Restoring…" : "Restore database"}
        </Button>
      </form>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
      ) : null}
    </div>
  );
}
