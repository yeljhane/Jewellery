import Link from "next/link";
import { notFound } from "next/navigation";
import { submitStockCount } from "@/lib/inventory-security-actions";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function StockCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["OWNER", "MANAGER", "SALES", "WORKSHOP"]);
  const { id } = await params;
  const count = await prisma.stockCount.findUnique({
    where: { id },
    include: {
      location: true,
      lines: { include: { /* no nested product on line */ } },
    },
  });
  if (!count) notFound();

  const productIds = [...new Set(count.lines.map((l) => l.productId).filter(Boolean))] as string[];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  return (
    <div>
      <PageHeader
        title={count.countNumber}
        description={`${count.location?.name || "All locations"} · ${count.status}`}
        actions={
          <Link href="/inventory/counts" className="text-sm text-[var(--gold-deep)] hover:underline">
            All counts
          </Link>
        }
      />
      <Card
        title="Tick pieces present"
        action={<Badge tone={count.status === "OPEN" ? "warn" : "success"}>{count.status}</Badge>}
      >
        {count.status !== "OPEN" ? (
          <p className="mb-4 text-sm text-[var(--muted)]">This count is closed.</p>
        ) : null}
        <ActionForm action={submitStockCount} successTitle="Count submitted" successMessage="The stock count was submitted successfully.">
          <input type="hidden" name="id" value={count.id} />
          <ul className="mb-4 divide-y divide-[var(--border)]">
            {count.lines.map((line) => {
              const product = line.productId ? productMap.get(line.productId) : null;
              return (
                <li key={line.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium">{line.serialNumber}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {product ? `${product.sku} — ${product.name}` : "—"}
                    </p>
                  </div>
                  {count.status === "OPEN" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="present"
                        value={line.id}
                        defaultChecked={line.countedPresent}
                      />
                      Present
                    </label>
                  ) : (
                    <Badge tone={line.countedPresent ? "success" : "danger"}>
                      {line.countedPresent ? "Present" : "Missing"}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
          {count.status === "OPEN" ? (
            <Button type="submit">Complete count</Button>
          ) : null}
        </ActionForm>
      </Card>
    </div>
  );
}
