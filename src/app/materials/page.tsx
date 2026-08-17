import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatWeight } from "@/lib/utils";
import { Badge, Card, DataTable, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const materials = await prisma.rawMaterial.findMany({
    include: { supplier: true },
    orderBy: { updatedAt: "desc" },
  });

  const metalTotal = materials
    .filter((m) => m.type === "METAL")
    .reduce((sum, m) => sum + m.weightGrams, 0);

  return (
    <div>
      <PageHeader
        title="Raw Materials"
        description={`Bullion, stones, and findings. Metal on hand: ${formatWeight(metalTotal)}.`}
        actions={
          <Link
            href="/materials/new"
            className="rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
          >
            Add Material
          </Link>
        }
      />
      <Card>
        {materials.length === 0 ? (
          <EmptyState title="No raw materials" description="Add gold, silver, or stones to begin manufacturing." />
        ) : (
          <DataTable
            headers={["Name", "Type", "Spec", "Qty / Weight", "Cost/Unit", "Location", "Supplier"]}
          >
            {materials.map((m) => (
              <tr key={m.id} className="hover:bg-stone-50/80">
                <td className="px-3 py-3 font-medium">{m.name}</td>
                <td className="px-3 py-3">
                  <Badge tone="info">{m.type}</Badge>
                </td>
                <td className="px-3 py-3">
                  {m.metal ? (
                    <Badge tone="gold">
                      {m.metal} {m.purity}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3">
                  {m.unit === "g" ? formatWeight(m.weightGrams || m.quantity) : `${m.quantity} ${m.unit}`}
                </td>
                <td className="px-3 py-3">{formatCurrency(m.costPerUnit)}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{m.location ?? "—"}</td>
                <td className="px-3 py-3">{m.supplier?.name ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
