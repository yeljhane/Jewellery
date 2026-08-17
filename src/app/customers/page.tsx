import Link from "next/link";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { DeleteButton } from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; outstanding?: string }>;
}) {
  const { q, outstanding } = await searchParams;
  const query = (q ?? "").trim();
  const onlyOutstanding = outstanding === "1";

  const settings = await prisma.shopSettings.findFirst();
  const currency = settings?.currency ?? "INR";

  const customers = await prisma.customer.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            { phone: { contains: query } },
            { email: { contains: query } },
            { gstin: { contains: query } },
            { address: { contains: query } },
          ],
        }
      : undefined,
    include: {
      sales: {
        select: {
          id: true,
          totalAmount: true,
          paidAmount: true,
          txnType: true,
        },
      },
      _count: { select: { sales: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = customers
    .map((c) => {
      const outstandingAmt = c.sales
        .filter((s) => !s.txnType.endsWith("_RETURN"))
        .reduce((sum, s) => sum + Math.max(0, s.totalAmount - s.paidAmount), 0);
      return { ...c, outstandingAmt };
    })
    .filter((c) => (onlyOutstanding ? c.outstandingAmt > 0.01 : true));

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Retail and wholesale customer directory, history, and udhaar."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Add Customer" className="lg:col-span-1">
          <form action={createCustomer} className="space-y-3">
            <Input label="Name" name="name" required />
            <Input label="Phone" name="phone" />
            <Input label="Email" name="email" type="email" />
            <Input label="GSTIN" name="gstin" />
            <Select label="VIP tier" name="vipTier" defaultValue="STANDARD">
              <option value="STANDARD">Standard</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="PLATINUM">Platinum</option>
            </Select>
            <Input label="Tags" name="tags" placeholder="bridal, nri, hotel" />
            <Input label="Preferred metal" name="preferredMetal" placeholder="YELLOW GOLD" />
            <Input label="Preferred stone" name="preferredStone" placeholder="Diamond" />
            <Select label="Marketing opt-in" name="marketingOptIn" defaultValue="1">
              <option value="1">Yes</option>
              <option value="0">No</option>
            </Select>
            <Textarea label="Address" name="address" rows={2} />
            <Textarea label="Notes" name="notes" rows={2} />
            <Button type="submit">Save Customer</Button>
          </form>
        </Card>
        <Card
          title="Directory"
          className="lg:col-span-2"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={onlyOutstanding ? "/customers" : "/customers?outstanding=1"}
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                {onlyOutstanding ? "Show all" : "With outstanding"}
              </Link>
              <form className="flex gap-2">
                {onlyOutstanding ? <input type="hidden" name="outstanding" value="1" /> : null}
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search name, phone, GSTIN…"
                  className="w-52 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
                />
                <Button type="submit" variant="secondary" className="!py-1.5">
                  Search
                </Button>
              </form>
            </div>
          }
        >
          {rows.length === 0 ? (
            <EmptyState
              title={query || onlyOutstanding ? "No matches" : "No customers"}
              description={
                onlyOutstanding
                  ? "No customers with outstanding balance."
                  : query
                    ? `Nothing found for “${query}”.`
                    : undefined
              }
            />
          ) : (
            <DataTable headers={["Name", "VIP", "Phone", "Sales", "Outstanding", ""]}>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3 font-medium">
                    <Link href={`/customers/${c.id}`} className="text-[var(--gold-deep)] hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-xs uppercase tracking-wide">
                    {c.vipTier !== "STANDARD" ? c.vipTier : "—"}
                  </td>
                  <td className="px-3 py-3">{c.phone ?? "—"}</td>
                  <td className="px-3 py-3">{c._count.sales}</td>
                  <td className="px-3 py-3">
                    {c.outstandingAmt > 0.01 ? (
                      <span className="font-medium text-amber-800">
                        {formatCurrency(c.outstandingAmt, currency)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <DeleteButton
                      action={deleteCustomer}
                      id={c.id}
                      message={`Delete ${c.name}? Only allowed if they have no sales.`}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Quick edit</h2>
        {rows.slice(0, 8).map((c) => (
          <Card key={c.id} title={c.name}>
            <form action={updateCustomer} className="grid gap-3 md:grid-cols-3">
              <input type="hidden" name="id" value={c.id} />
              <Input label="Name" name="name" defaultValue={c.name} required />
              <Input label="Phone" name="phone" defaultValue={c.phone ?? ""} />
              <Input label="Email" name="email" type="email" defaultValue={c.email ?? ""} />
              <Input label="GSTIN" name="gstin" defaultValue={c.gstin ?? ""} />
              <Select label="VIP tier" name="vipTier" defaultValue={c.vipTier || "STANDARD"}>
                <option value="STANDARD">Standard</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="PLATINUM">Platinum</option>
              </Select>
              <Input label="Tags" name="tags" defaultValue={c.tags ?? ""} />
              <Input label="Preferred metal" name="preferredMetal" defaultValue={c.preferredMetal ?? ""} />
              <Input label="Preferred stone" name="preferredStone" defaultValue={c.preferredStone ?? ""} />
              <Select label="Marketing opt-in" name="marketingOptIn" defaultValue={c.marketingOptIn ? "1" : "0"}>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </Select>
              <Textarea label="Address" name="address" rows={2} defaultValue={c.address ?? ""} />
              <Textarea label="Notes" name="notes" rows={2} defaultValue={c.notes ?? ""} />
              <div className="flex items-end gap-2 md:col-span-3">
                <Button type="submit" variant="secondary">
                  Save changes
                </Button>
                <Link href={`/customers/${c.id}`} className="text-sm text-[var(--gold-deep)] hover:underline">
                  Open profile
                </Link>
              </div>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
