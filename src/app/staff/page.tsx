import { createStaff, updateStaff, toggleStaffActive } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { STAFF_ROLES } from "@/lib/permissions";
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { ConfirmForm } from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const staff = await prisma.employee.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Manage employee logins, roles, and access. Default seed: admin / admin123"
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Add Staff" className="lg:col-span-1">
          <form action={createStaff} className="space-y-3">
            <Input label="Name" name="name" required />
            <Select label="Role" name="role" defaultValue="SALES" required>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Input label="Phone" name="phone" />
            <Input label="Email" name="email" type="email" />
            <Input label="Username" name="username" autoComplete="off" />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min 6 characters"
            />
            <Input
              label="Commission % (blank = company default)"
              name="commissionPct"
              type="number"
              step="0.1"
              min="0"
            />
            <Button type="submit">Create Staff</Button>
          </form>
        </Card>

        <Card title="Directory" className="lg:col-span-2">
          {staff.length === 0 ? (
            <EmptyState title="No staff" />
          ) : (
            <div className="space-y-6">
              <DataTable headers={["Name", "Role", "Commission", "Username", "Status", ""]}>
                {staff.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50/80">
                    <td className="px-3 py-3 font-medium">{e.name}</td>
                    <td className="px-3 py-3">{e.role}</td>
                    <td className="px-3 py-3">
                      {e.commissionPct != null ? `${e.commissionPct}%` : "Default"}
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">{e.username ?? "—"}</td>
                    <td className="px-3 py-3">{e.active ? "Active" : "Inactive"}</td>
                    <td className="px-3 py-3">
                      <ConfirmForm
                        action={toggleStaffActive}
                        message={
                          e.active
                            ? `Deactivate ${e.name}? They will not be able to sign in.`
                            : `Reactivate ${e.name}?`
                        }
                      >
                        <input type="hidden" name="id" value={e.id} />
                        <Button type="submit" variant="secondary" className="!px-2 !py-1 text-xs">
                          {e.active ? "Deactivate" : "Activate"}
                        </Button>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))}
              </DataTable>

              <div className="space-y-4 border-t border-[var(--border)] pt-4">
                <h3 className="text-sm font-semibold">Edit credentials</h3>
                {staff.map((e) => (
                  <form
                    key={e.id}
                    action={updateStaff}
                    className="grid gap-2 rounded-lg border border-[var(--border)] p-3 md:grid-cols-3"
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <Input label="Name" name="name" defaultValue={e.name} required />
                    <Select label="Role" name="role" defaultValue={e.role} required>
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                    <Input label="Phone" name="phone" defaultValue={e.phone ?? ""} />
                    <Input label="Email" name="email" type="email" defaultValue={e.email ?? ""} />
                    <Input
                      label="Username"
                      name="username"
                      defaultValue={e.username ?? ""}
                      autoComplete="off"
                    />
                    <Input
                      label="New password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Leave blank to keep"
                    />
                    <Input
                      label="Commission %"
                      name="commissionPct"
                      type="number"
                      step="0.1"
                      min="0"
                      defaultValue={e.commissionPct ?? ""}
                      placeholder="Company default"
                    />
                    <label className="flex items-end gap-2 pb-2 text-sm">
                      <input type="checkbox" name="active" value="1" defaultChecked={e.active} />
                      Active
                    </label>
                    <div className="flex items-end">
                      <Button type="submit" variant="secondary" className="!py-1.5">
                        Save {e.name.split(" ")[0]}
                      </Button>
                    </div>
                  </form>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
