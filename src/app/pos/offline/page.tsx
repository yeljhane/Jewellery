import Link from "next/link";
import { resolveOfflinePosTransaction } from "@/lib/offline-pos-actions";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { OfflineQueuePanel } from "@/components/OfflineQueuePanel";
import { ConfirmForm } from "@/components/ConfirmForm";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function OfflinePosPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [transactions, syncedToday, conflicts, failed] = await Promise.all([
    prisma.offlinePosTransaction.findMany({ include: { sale: true }, orderBy: { queuedAt: "desc" }, take: 100 }),
    prisma.offlinePosTransaction.count({ where: { status: "SYNCED", syncedAt: { gte: today } } }),
    prisma.offlinePosTransaction.count({ where: { status: "CONFLICT" } }),
    prisma.offlinePosTransaction.count({ where: { status: "FAILED" } }),
  ]);
  const review = transactions.filter((transaction) => ["CONFLICT", "FAILED"].includes(transaction.status));

  return (
    <div>
      <PageHeader
        title="Offline POS Synchronization"
        description="Monitor device queues, reconnect synchronization, idempotent imports, and stock conflicts."
        actions={<Link href="/pos" className="text-sm text-[var(--gold-deep)] hover:underline">Back to POS</Link>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Synchronized today" value={String(syncedToday)} />
        <StatCard label="Conflicts" value={String(conflicts)} accent={conflicts > 0} />
        <StatCard label="Failed" value={String(failed)} />
      </div>

      <Card title="This device's local queue" className="mb-6">
        <p className="mb-4 text-xs text-[var(--muted)]">This queue is stored locally in this browser. It synchronizes automatically when the connection returns.</p>
        <OfflineQueuePanel />
      </Card>

      <Card title="Conflict resolution" className="mb-6">
        {review.length === 0 ? (
          <EmptyState title="No transactions need review" description="Stock conflicts and failed imports will appear here." />
        ) : (
          <div className="space-y-3">
            {review.map((transaction) => (
              <article key={transaction.id} className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><Badge tone={transaction.status === "CONFLICT" ? "danger" : "warn"}>{transaction.status}</Badge><span className="text-xs text-[var(--muted)]">Attempt {transaction.attempts}</span></div>
                    <p className="mt-2 whitespace-pre-line text-sm">{transaction.conflictDetails || transaction.lastError || "Synchronization failed."}</p>
                    <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">{transaction.clientTxnId}</p>
                  </div>
                  <div className="flex gap-2">
                    <ActionForm action={resolveOfflinePosTransaction} successTitle="Synchronization retried" successMessage="The offline transaction was processed again.">
                      <input type="hidden" name="id" value={transaction.id} /><input type="hidden" name="resolution" value="RETRY" />
                      <Button type="submit" variant="secondary">Retry after stock update</Button>
                    </ActionForm>
                    <ConfirmForm action={resolveOfflinePosTransaction} message="Discard this offline import? The server record will remain in history, but it will no longer synchronize.">
                      <input type="hidden" name="id" value={transaction.id} /><input type="hidden" name="resolution" value="DISCARD" />
                      <Button type="submit" variant="danger">Discard import</Button>
                    </ConfirmForm>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Card title="Synchronization history">
        {transactions.length === 0 ? (
          <EmptyState title="No offline transactions" />
        ) : (
          <DataTable headers={["Queued", "Device", "Transaction", "Status", "Invoice"]}>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="px-3 py-3 text-xs">{transaction.queuedAt.toLocaleString()}</td>
                <td className="px-3 py-3 font-mono text-[11px]">{transaction.deviceId?.slice(0, 8) || "—"}</td>
                <td className="px-3 py-3 font-mono text-[11px]">{transaction.clientTxnId.slice(0, 12)}</td>
                <td className="px-3 py-3"><Badge tone={transaction.status === "SYNCED" ? "success" : transaction.status === "CONFLICT" ? "danger" : transaction.status === "FAILED" ? "warn" : "neutral"}>{transaction.status}</Badge></td>
                <td className="px-3 py-3">{transaction.sale ? <Link href={`/sales/${transaction.sale.id}`} className="text-[var(--gold-deep)] hover:underline">{transaction.sale.invoiceNumber}</Link> : "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
