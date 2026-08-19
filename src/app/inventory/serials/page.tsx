import Link from "next/link";
import { createInventorySerialSecure, adjustInventoryItem } from "@/lib/inventory-security-actions";
import { prisma } from "@/lib/prisma";
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function SerialsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const query = (q ?? "").trim();
  const statusFilter = (status ?? "").trim();

  const [products, locations, serials, settings] = await Promise.all([
    prisma.product.findMany({
      where: { status: { in: ["IN_STOCK", "IN_PRODUCTION"] } },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.stockLocation.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({
      where: {
        AND: [
          statusFilter ? { status: statusFilter } : {},
          query
            ? {
                OR: [
                  { serialNumber: { contains: query } },
                  { rfidTag: { contains: query } },
                  { product: { name: { contains: query } } },
                  { product: { sku: { contains: query } } },
                ],
              }
            : {},
        ],
      },
      include: { product: true, location: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.shopSettings.findFirst(),
  ]);
  const dual = settings?.dualAuthAdjustments !== false;

  return (
    <div>
      <PageHeader
        title="Serialized Inventory"
        description="Unique tracking for every valuable piece — serial, RFID, location."
        actions={
          <div className="flex gap-3 text-sm">
            <Link href="/inventory/security" className="text-[var(--gold-deep)] hover:underline">
              Security
            </Link>
            <Link href="/inventory" className="text-[var(--gold-deep)] hover:underline">
              Finished stock
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Register Serials" className="lg:col-span-1">
          <ActionForm action={createInventorySerialSecure} successMessage="The serialized inventory data was added successfully." className="space-y-3">
            <Select label="Product" name="productId" required defaultValue="">
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </Select>
            <Input label="Serial / Tag (optional)" name="serialNumber" placeholder="Auto if blank" />
            <Input label="RFID tag (optional)" name="rfidTag" placeholder="EPC / tag ID" />
            <Select label="Location" name="locationId" defaultValue="">
              <option value="">Unassigned</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.kind})
                </option>
              ))}
            </Select>
            <Input label="Quantity to create" name="quantity" type="number" min={1} defaultValue={1} />
            <Input label="Location note" name="locationNote" placeholder="Tray / drawer" />
            <Input label="Cost" name="costPrice" type="number" step="0.01" />
            <Textarea label="Notes" name="notes" rows={2} />
            <Button type="submit">Add Serials</Button>
          </ActionForm>
        </Card>
        <Card title="Piece Register" className="lg:col-span-2">
          <form className="mb-4 flex flex-wrap gap-2">
            <Select name="status" defaultValue={statusFilter}>
              <option value="">All statuses</option>
              <option value="IN_STOCK">In stock</option>
              <option value="SOLD">Sold</option>
              <option value="IN_REPAIR">In repair</option>
              <option value="IN_TRANSIT">In transit</option>
              <option value="MISSING">Missing</option>
              <option value="RESERVED">Reserved</option>
            </Select>
            <input
              name="q"
              defaultValue={query}
              placeholder="Search serial, RFID, SKU…"
              className="w-44 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm"
            />
            <Button type="submit" variant="secondary" className="!py-1.5">
              Filter
            </Button>
          </form>
          {serials.length === 0 ? (
            <EmptyState title="No serials yet" description="Register piece-level tags for high-value stock." />
          ) : (
            <DataTable headers={["Serial", "RFID", "Product", "Location", "Status"]}>
              {serials.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border)] hover:bg-stone-50/80">
                  <td className="px-3 py-3 font-medium">{s.serialNumber}</td>
                  <td className="px-3 py-3 text-xs">{s.rfidTag || "—"}</td>
                  <td className="px-3 py-3">
                    {s.product.sku} — {s.product.name}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {s.location?.name || s.locationNote || "—"}
                  </td>
                  <td className="px-3 py-3 text-xs">{s.status.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <Card title="Sensitive status adjustment (dual auth)" className="mt-6">
        <ActionForm action={adjustInventoryItem} successTitle="Inventory updated" successMessage="The serialized item's status was updated successfully." className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Select label="Serial" name="inventoryItemId" required defaultValue="">
            <option value="">Select</option>
            {serials.map((s) => (
              <option key={s.id} value={s.id}>
                {s.serialNumber}
              </option>
            ))}
          </Select>
          <Select label="New status" name="status" defaultValue="MISSING">
            <option value="IN_STOCK">In stock</option>
            <option value="RESERVED">Reserved</option>
            <option value="MISSING">Missing</option>
            <option value="IN_REPAIR">In repair</option>
          </Select>
          <Select label="Move to location" name="locationId" defaultValue="">
            <option value="">Keep current</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Input label="Reason / note" name="note" className="md:col-span-2" required />
          {dual ? (
            <>
              <Input label="Approver username" name="approverUsername" required />
              <Input label="Approver password" name="approverPassword" type="password" required />
            </>
          ) : null}
          <div className="flex items-end">
            <Button type="submit">Apply adjustment</Button>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
