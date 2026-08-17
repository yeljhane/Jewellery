import Link from "next/link";
import {
  approveStockTransfer,
  confirmStockTransfer,
  rejectStockTransfer,
  requestStockTransfer,
} from "@/lib/inventory-security-actions";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StockTransfersPage() {
  await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const [locations, serials, transfers, settings] = await Promise.all([
    prisma.stockLocation.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({
      where: { status: "IN_STOCK" },
      include: { product: true },
      orderBy: { serialNumber: "asc" },
      take: 300,
    }),
    prisma.stockTransfer.findMany({
      include: { fromLocation: true, toLocation: true, items: true },
      orderBy: { requestedAt: "desc" },
      take: 50,
    }),
    prisma.shopSettings.findFirst(),
  ]);
  const dual = settings?.dualAuthTransfers !== false;

  return (
    <div>
      <PageHeader
        title="Stock Transfers"
        description="Request → dual-authorize approve → destination confirm. Pieces stay IN_TRANSIT until confirmed."
        actions={
          <Link href="/inventory/security" className="text-sm text-[var(--gold-deep)] hover:underline">
            Security hub
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Request transfer" className="lg:col-span-1">
          <form action={requestStockTransfer} className="space-y-3">
            <Select label="From" name="fromLocationId" required defaultValue="">
              <option value="">Select</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.kind})
                </option>
              ))}
            </Select>
            <Select label="To" name="toLocationId" required defaultValue="">
              <option value="">Select</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.kind})
                </option>
              ))}
            </Select>
            <Select label="Serial piece" name="inventoryItemId" defaultValue="">
              <option value="">Select piece</option>
              {serials.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.serialNumber} — {s.product.sku}
                </option>
              ))}
            </Select>
            <Textarea label="Notes" name="notes" rows={2} />
            <Button type="submit">Submit request</Button>
          </form>
        </Card>
        <Card title="Transfer queue" className="lg:col-span-2">
          {transfers.length === 0 ? (
            <EmptyState title="No transfers" description="Create a request to move a piece between locations." />
          ) : (
            <div className="space-y-4">
              {transfers.map((t) => (
                <div key={t.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {t.transferNumber}{" "}
                        <Badge
                          tone={
                            t.status === "COMPLETED"
                              ? "success"
                              : t.status === "REJECTED"
                                ? "danger"
                                : "warn"
                          }
                        >
                          {t.status}
                        </Badge>
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {t.fromLocation.name} → {t.toLocation.name}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {t.items.map((i) => i.serialNumber).filter(Boolean).join(", ") || "No lines"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {t.status === "PENDING" ? (
                        <form action={approveStockTransfer} className="space-y-2 rounded-lg border border-[var(--border)] p-2">
                          <input type="hidden" name="id" value={t.id} />
                          {dual ? (
                            <>
                              <Input label="Approver username" name="approverUsername" required />
                              <Input
                                label="Approver password"
                                name="approverPassword"
                                type="password"
                                required
                              />
                            </>
                          ) : null}
                          <div className="flex gap-2">
                            <Button type="submit" className="!py-1 !text-xs">
                              Approve
                            </Button>
                          </div>
                        </form>
                      ) : null}
                      {t.status === "PENDING" ? (
                        <form action={rejectStockTransfer}>
                          <input type="hidden" name="id" value={t.id} />
                          <Button type="submit" variant="secondary" className="!py-1 !text-xs">
                            Reject
                          </Button>
                        </form>
                      ) : null}
                      {t.status === "IN_TRANSIT" ? (
                        <form action={confirmStockTransfer}>
                          <input type="hidden" name="id" value={t.id} />
                          <Button type="submit" className="!py-1 !text-xs">
                            Confirm receipt
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
