import Link from "next/link";
import { notFound } from "next/navigation";
import { updateRepairStatus } from "@/lib/jewelry-pos-actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [repair, settings] = await Promise.all([
    prisma.repairOrder.findUnique({
      where: { id },
      include: { customer: true, product: true, inventoryItem: true },
    }),
    prisma.shopSettings.findFirst(),
  ]);
  if (!repair) notFound();
  const currency = settings?.currency ?? "AZN";

  return (
    <div>
      <PageHeader
        title={repair.ticketNumber}
        description={`${repair.repairType} · ${repair.status.replaceAll("_", " ")}`}
        actions={
          <Link href="/repairs" className="text-sm text-[var(--gold-deep)] hover:underline">
            All repairs
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ticket">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Customer</dt>
              <dd>{repair.customer?.name || repair.customerName || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Product</dt>
              <dd>{repair.product ? `${repair.product.sku} — ${repair.product.name}` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Serial</dt>
              <dd>{repair.inventoryItem?.serialNumber || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Description</dt>
              <dd className="text-right">{repair.description}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Deposit</dt>
              <dd>{formatCurrency(repair.depositAmount, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Total charge</dt>
              <dd>{formatCurrency(repair.totalCharge, currency)}</dd>
            </div>
            {repair.notes ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Notes</dt>
                <dd className="text-right">{repair.notes}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
        <Card title="Update Status">
          <ActionForm action={updateRepairStatus} successTitle="Repair updated" successMessage="The repair status was updated successfully." className="space-y-3">
            <input type="hidden" name="id" value={repair.id} />
            <Select label="Status" name="status" defaultValue={repair.status}>
              <option value="RECEIVED">Received</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="READY">Ready</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Input
              label="Labour cost"
              name="labourCost"
              type="number"
              step="0.01"
              defaultValue={repair.labourCost || ""}
            />
            <Input
              label="Material cost"
              name="materialCost"
              type="number"
              step="0.01"
              defaultValue={repair.materialCost || ""}
            />
            <Button type="submit">Save</Button>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
