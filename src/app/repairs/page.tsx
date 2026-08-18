import Link from "next/link";
import { createRepairOrder } from "@/lib/jewelry-pos-actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RepairsPage() {
  const [settings, customers, products, serials, repairs] = await Promise.all([
    prisma.shopSettings.findFirst(),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, take: 100 }),
    prisma.inventoryItem.findMany({
      where: { status: { in: ["IN_STOCK", "SOLD", "IN_REPAIR"] } },
      include: { product: true },
      orderBy: { serialNumber: "asc" },
      take: 200,
    }),
    prisma.repairOrder.findMany({
      include: { customer: true, product: true, inventoryItem: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const currency = settings?.currency ?? "AZN";

  return (
    <div>
      <PageHeader
        title="Repairs & After-Sales"
        description="Resize, repair, polish — take-in tickets through delivery."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="New Ticket" className="lg:col-span-1">
          <form action={createRepairOrder} className="space-y-3">
            <Select label="Customer" name="customerId" defaultValue="">
              <option value="">Walk-in / other</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.vipTier !== "STANDARD" ? ` (${c.vipTier})` : ""}
                </option>
              ))}
            </Select>
            <Input label="Customer name (if walk-in)" name="customerName" />
            <Select label="Type" name="repairType" defaultValue="REPAIR">
              <option value="REPAIR">Repair</option>
              <option value="RESIZE">Resize</option>
              <option value="POLISH">Polish</option>
              <option value="OTHER">Other</option>
            </Select>
            <Select label="Product (optional)" name="productId" defaultValue="">
              <option value="">None</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </Select>
            <Select label="Serial (optional)" name="inventoryItemId" defaultValue="">
              <option value="">None</option>
              {serials.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.serialNumber} — {s.product.name}
                </option>
              ))}
            </Select>
            <Textarea label="Work description" name="description" rows={2} required />
            <Input label="Estimated cost" name="estimatedCost" type="number" step="0.01" />
            <Input label="Deposit" name="depositAmount" type="number" step="0.01" />
            <Input label="Due date" name="dueDate" type="date" />
            <Textarea label="Notes" name="notes" rows={2} />
            <Button type="submit">Create Ticket</Button>
          </form>
        </Card>
        <Card title="Open & Recent" className="lg:col-span-2">
          {repairs.length === 0 ? (
            <EmptyState title="No repair tickets" description="Create a take-in ticket to start." />
          ) : (
            <DataTable headers={["Ticket", "Customer", "Type", "Status", "Est.", ""]}>
              {repairs.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3 font-medium">{r.ticketNumber}</td>
                  <td className="px-3 py-3">{r.customer?.name || r.customerName || "—"}</td>
                  <td className="px-3 py-3">{r.repairType}</td>
                  <td className="px-3 py-3">{r.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-3">{formatCurrency(r.estimatedCost, currency)}</td>
                  <td className="px-3 py-3">
                    <Link href={`/repairs/${r.id}`} className="text-[var(--gold-deep)] hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
