import Link from "next/link";
import { notFound } from "next/navigation";
import { addCaseInteraction, updateCustomerServiceCase } from "@/lib/customer-service-actions";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

export default async function CustomerServiceCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [serviceCase, staff] = await Promise.all([
    prisma.customerServiceCase.findUnique({
      where: { id },
      include: {
        customer: true,
        sale: true,
        assignedTo: true,
        createdBy: true,
        interactions: { include: { author: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!serviceCase) notFound();
  const active = !["RESOLVED", "CLOSED"].includes(serviceCase.status);
  const overdue = active && serviceCase.slaDueAt < new Date();

  return (
    <div>
      <PageHeader
        title={`${serviceCase.caseNumber} · ${serviceCase.subject}`}
        description={`${serviceCase.type.replaceAll("_", " ")} · Opened ${serviceCase.createdAt.toLocaleString()}`}
        actions={<Link href="/service" className="text-sm text-[var(--gold-deep)] hover:underline">Back to case queue</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Case details">
            <div className="mb-5 flex flex-wrap gap-2">
              <Badge tone={overdue ? "danger" : "info"}>{serviceCase.status.replaceAll("_", " ")}</Badge>
              <Badge tone={serviceCase.priority === "CRITICAL" ? "danger" : serviceCase.priority === "HIGH" ? "warn" : "neutral"}>{serviceCase.priority}</Badge>
              <Badge>{serviceCase.channel.replaceAll("_", " ")}</Badge>
            </div>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-[var(--muted)]">Customer</dt><dd>{serviceCase.customer?.name || serviceCase.contactName || "Walk-in"}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Contact</dt><dd>{serviceCase.contactPhone || serviceCase.contactEmail || "—"}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Related invoice</dt><dd>{serviceCase.sale ? <Link className="text-[var(--gold-deep)] hover:underline" href={`/sales/${serviceCase.sale.id}`}>{serviceCase.sale.invoiceNumber}</Link> : "—"}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">SLA deadline</dt><dd className={overdue ? "font-semibold text-rose-700" : ""}>{serviceCase.slaDueAt.toLocaleString()}{overdue ? " · OVERDUE" : ""}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-[var(--muted)]">Description</dt><dd className="mt-1 whitespace-pre-wrap">{serviceCase.description}</dd></div>
            </dl>
          </Card>

          <Card title="Interaction history">
            <ActionForm action={addCaseInteraction} successMessage="The interaction was added successfully." className="mb-6 grid gap-3 rounded-xl border border-[var(--border)] bg-stone-50/70 p-4 sm:grid-cols-2">
              <input type="hidden" name="caseId" value={serviceCase.id} />
              <Select label="Channel" name="channel" defaultValue="NOTE">
                <option value="NOTE">Internal note</option><option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option>
                <option value="IN_PERSON">In person</option><option value="SOCIAL">Social</option>
              </Select>
              <Select label="Direction" name="direction" defaultValue="INTERNAL">
                <option value="INTERNAL">Internal</option><option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option>
              </Select>
              <div className="sm:col-span-2"><Textarea label="Summary" name="summary" rows={3} required /></div>
              <Input label="Next follow-up" name="nextFollowUpAt" type="datetime-local" />
              <div className="flex items-end"><Button type="submit">Add interaction</Button></div>
            </ActionForm>
            <div className="space-y-3">
              {serviceCase.interactions.map((interaction) => (
                <article key={interaction.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2"><Badge>{interaction.channel}</Badge><Badge tone="info">{interaction.direction}</Badge></div>
                    <span className="text-xs text-[var(--muted)]">{interaction.createdAt.toLocaleString()} · {interaction.author?.name || "System"}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{interaction.summary}</p>
                  {interaction.nextFollowUpAt ? <p className="mt-2 text-xs text-amber-800">Follow up: {interaction.nextFollowUpAt.toLocaleString()}</p> : null}
                </article>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Ownership and status" className="h-fit">
          <ActionForm action={updateCustomerServiceCase} successTitle="Case updated" successMessage="The customer-service case was updated successfully." className="space-y-3">
            <input type="hidden" name="id" value={serviceCase.id} />
            <Select label="Status" name="status" defaultValue={serviceCase.status}>
              <option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option>
              <option value="WAITING_CUSTOMER">Waiting for customer</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option>
            </Select>
            <Select label="Priority" name="priority" defaultValue={serviceCase.priority}>
              <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
            </Select>
            <Select label="Assigned to" name="assignedToId" defaultValue={serviceCase.assignedToId || ""}>
              <option value="">Unassigned</option>
              {staff.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </Select>
            <Button type="submit">Save case</Button>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
