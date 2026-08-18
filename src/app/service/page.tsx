import Link from "next/link";
import { createCustomerServiceCase } from "@/lib/customer-service-actions";
import { normalizeLanguage } from "@/lib/localization";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Select, StatCard, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

const COPY = {
  AZ: ["Müştəri xidməti", "Şikayətləri, sorğuları, xidmət biletlərini və SLA-ları təmir sifarişlərindən ayrıca idarə edin."],
  RU: ["Обслуживание клиентов", "Управляйте жалобами, запросами, сервисными заявками и SLA отдельно от ремонтных заказов."],
  AR: ["إدارة خدمة العملاء", "إدارة الشكاوى والاستفسارات وتذاكر الخدمة واتفاقيات مستوى الخدمة بعيداً عن طلبات الإصلاح."],
  EN: ["Customer Service", "Manage complaints, enquiries, service tickets, and SLAs separately from repair orders."],
} as const;

function statusTone(status: string) {
  if (status === "RESOLVED" || status === "CLOSED") return "success" as const;
  if (status === "WAITING_CUSTOMER") return "warn" as const;
  return "info" as const;
}

export default async function CustomerServicePage() {
  const now = new Date();
  const [settings, cases, customers, staff, sales, openCount, overdueCount, resolvedCount] = await Promise.all([
    prisma.shopSettings.findFirst({ select: { interfaceLanguage: true } }),
    prisma.customerServiceCase.findMany({
      include: { customer: true, assignedTo: true, _count: { select: { interactions: true } } },
      orderBy: [{ status: "asc" }, { slaDueAt: "asc" }],
      take: 100,
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, take: 500 }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.sale.findMany({ where: { status: "COMPLETED" }, orderBy: { saleDate: "desc" }, take: 100 }),
    prisma.customerServiceCase.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
    prisma.customerServiceCase.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] }, slaDueAt: { lt: now } } }),
    prisma.customerServiceCase.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
  ]);
  const language = normalizeLanguage(settings?.interfaceLanguage);
  const [title, description] = COPY[language];

  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Open cases" value={String(openCount)} />
        <StatCard label="SLA overdue" value={String(overdueCount)} hint="Requires immediate attention" accent={overdueCount > 0} />
        <StatCard label="Resolved / closed" value={String(resolvedCount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card title="Open a case">
          <form action={createCustomerServiceCase} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Case type" name="type" defaultValue="ENQUIRY">
                <option value="COMPLAINT">Complaint</option>
                <option value="ENQUIRY">Enquiry</option>
                <option value="SERVICE_TICKET">Service ticket</option>
              </Select>
              <Select label="Priority" name="priority" defaultValue="NORMAL">
                <option value="LOW">Low</option><option value="NORMAL">Normal</option>
                <option value="HIGH">High</option><option value="CRITICAL">Critical</option>
              </Select>
            </div>
            <Select label="Customer (optional)" name="customerId" defaultValue="">
              <option value="">Walk-in / unregistered</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Contact name" name="contactName" />
              <Input label="Contact phone" name="contactPhone" />
            </div>
            <Input label="Contact email" name="contactEmail" type="email" />
            <Select label="Related invoice (optional)" name="saleId" defaultValue="">
              <option value="">No linked invoice</option>
              {sales.map((sale) => <option key={sale.id} value={sale.id}>{sale.invoiceNumber} · {sale.customerName || "Walk-in"}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Channel" name="channel" defaultValue="IN_PERSON">
                <option value="IN_PERSON">In person</option><option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option>
                <option value="WEB">Web</option><option value="SOCIAL">Social</option>
              </Select>
              <Select label="Assign to" name="assignedToId" defaultValue="">
                <option value="">Unassigned</option>
                {staff.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </Select>
            </div>
            <Input label="Subject" name="subject" required />
            <Textarea label="Description" name="description" rows={5} required />
            <Button type="submit">Create case</Button>
          </form>
        </Card>

        <Card title="Case queue">
          {cases.length === 0 ? (
            <EmptyState title="No customer-service cases" description="Complaints, enquiries, and service tickets will appear here." />
          ) : (
            <DataTable headers={["Case", "Customer", "SLA", "Owner", "Status"]}>
              {cases.map((serviceCase) => {
                const active = !["RESOLVED", "CLOSED"].includes(serviceCase.status);
                const overdue = active && serviceCase.slaDueAt < now;
                return (
                  <tr key={serviceCase.id} className="hover:bg-stone-50/80">
                    <td className="px-3 py-3">
                      <Link href={`/service/${serviceCase.id}`} className="font-medium text-[var(--gold-deep)] hover:underline">{serviceCase.caseNumber}</Link>
                      <p className="max-w-[260px] truncate text-xs text-[var(--muted)]">{serviceCase.subject}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--muted)]">{serviceCase.type.replaceAll("_", " ")} · {serviceCase.priority}</p>
                    </td>
                    <td className="px-3 py-3">{serviceCase.customer?.name || serviceCase.contactName || "Walk-in"}</td>
                    <td className={`px-3 py-3 text-xs ${overdue ? "font-semibold text-rose-700" : "text-[var(--muted)]"}`}>
                      {overdue ? "Overdue · " : ""}{serviceCase.slaDueAt.toLocaleString()}<p>{serviceCase._count.interactions} interactions</p>
                    </td>
                    <td className="px-3 py-3">{serviceCase.assignedTo?.name || "Unassigned"}</td>
                    <td className="px-3 py-3"><Badge tone={overdue ? "danger" : statusTone(serviceCase.status)}>{serviceCase.status.replaceAll("_", " ")}</Badge></td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
