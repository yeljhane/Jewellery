import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatWeight } from "@/lib/utils";
import { Badge, Card, DataTable, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function jobTone(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "IN_PROGRESS") return "info" as const;
  if (status === "CANCELLED") return "danger" as const;
  return "warn" as const;
}

export default async function ManufacturingPage() {
  const jobs = await prisma.manufacturingJob.findMany({
    include: { karigar: true, product: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Manufacturing"
        description="Issue metal to karigars, track wastage, and receive finished pieces."
        actions={
          <Link
            href="/manufacturing/new"
            className="rounded-lg bg-[var(--gold-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold)]"
          >
            New Job Card
          </Link>
        }
      />
      <Card>
        {jobs.length === 0 ? (
          <EmptyState title="No job cards" description="Create a manufacturing job to issue metal." />
        ) : (
          <DataTable
            headers={["Job #", "Design", "Karigar", "Issued", "Returned", "Labour", "Due", "Status", ""]}
          >
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-stone-50/80">
                <td className="px-3 py-3">
                  <Link href={`/manufacturing/${j.id}`} className="font-medium text-[var(--gold-deep)]">
                    {j.jobNumber}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium">{j.designName}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {j.metal} {j.purity}
                  </div>
                </td>
                <td className="px-3 py-3">{j.karigar?.name ?? "—"}</td>
                <td className="px-3 py-3">{formatWeight(j.issuedWeight)}</td>
                <td className="px-3 py-3">{formatWeight(j.returnedWeight)}</td>
                <td className="px-3 py-3">{formatCurrency(j.labourCost)}</td>
                <td className="px-3 py-3 text-[var(--muted)]">
                  {j.dueDate ? formatDate(j.dueDate) : "—"}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={jobTone(j.status)}>{j.status.replace("_", " ")}</Badge>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/manufacturing/${j.id}`} className="text-xs text-[var(--gold-deep)]">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
