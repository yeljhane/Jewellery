import Link from "next/link";
import { notFound } from "next/navigation";
import { updateJobStatus } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatWeight } from "@/lib/utils";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.manufacturingJob.findUnique({
    where: { id },
    include: {
      karigar: true,
      product: true,
      materials: { include: { rawMaterial: true } },
    },
  });
  if (!job) notFound();

  return (
    <div>
      <PageHeader
        title={job.jobNumber}
        description={job.designName}
        actions={
          <Link href="/manufacturing" className="text-sm text-[var(--gold-deep)] hover:underline">
            All jobs
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Status</p>
          <div className="mt-2">
            <Badge
              tone={
                job.status === "COMPLETED"
                  ? "success"
                  : job.status === "IN_PROGRESS"
                    ? "info"
                    : "warn"
              }
            >
              {job.status.replace("_", " ")}
            </Badge>
          </div>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Issued</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">
            {formatWeight(job.issuedWeight)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Returned</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">
            {formatWeight(job.returnedWeight)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Wastage</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">
            {formatWeight(job.wastageWeight)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Job Details">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Metal</dt>
              <dd>
                {job.metal} {job.purity}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Karigar</dt>
              <dd>{job.karigar?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Labour</dt>
              <dd>{formatCurrency(job.labourCost)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Started</dt>
              <dd>{formatDate(job.startDate)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Due</dt>
              <dd>{job.dueDate ? formatDate(job.dueDate) : "—"}</dd>
            </div>
            {job.notes ? (
              <div>
                <dt className="text-[var(--muted)]">Notes</dt>
                <dd className="mt-1">{job.notes}</dd>
              </div>
            ) : null}
          </dl>
          {job.materials.length > 0 ? (
            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Materials issued
              </p>
              <ul className="space-y-2 text-sm">
                {job.materials.map((m) => (
                  <li key={m.id} className="flex justify-between">
                    <span>{m.rawMaterial.name}</span>
                    <span>{formatWeight(m.quantityUsed)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card title="Update Status">
          <ActionForm action={updateJobStatus} successTitle="Job updated" successMessage="The manufacturing job was updated successfully." className="space-y-4">
            <input type="hidden" name="id" value={job.id} />
            <Select label="Status" name="status" defaultValue={job.status}>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Input
              label="Returned Weight (g)"
              name="returnedWeight"
              type="number"
              step="0.001"
              defaultValue={job.returnedWeight || ""}
              placeholder="Enter when completing"
            />
            <p className="text-xs text-[var(--muted)]">
              Completing with a returned weight creates a finished stock item and calculates
              wastage (issued − returned).
            </p>
            <Button type="submit">Save Changes</Button>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
