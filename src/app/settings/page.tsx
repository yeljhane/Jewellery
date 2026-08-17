import { updateSettings } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOwnerOrManager } from "@/lib/permissions";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { CompanyLogoField } from "@/components/CompanyLogoField";
import { BackupRestorePanel } from "@/components/BackupRestorePanel";

export const dynamic = "force-dynamic";

const CURRENCIES = [
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
];

export default async function SettingsPage() {
  const settings = await prisma.shopSettings.findFirst();
  const session = await auth();
  const showBackup = isOwnerOrManager(session?.user?.role);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Company profile, logo, default jewellery calculation percentages, tax, and backups."
      />

      <form action={updateSettings} encType="multipart/form-data" className="space-y-6">
        <Card title="Company">
          <div className="grid max-w-3xl gap-4 md:grid-cols-2">
            <CompanyLogoField currentLogoUrl={settings?.logoUrl} />
            <div className="md:col-span-2">
              <Input
                label="Company Name"
                name="shopName"
                defaultValue={settings?.shopName ?? "Avenue JOAILLERIE"}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Address"
                name="address"
                rows={3}
                defaultValue={settings?.address ?? ""}
                placeholder="Street, city, state, PIN"
              />
            </div>
            <Input
              label="Email"
              name="email"
              type="email"
              defaultValue={settings?.email ?? ""}
              placeholder="hello@company.com"
            />
            <Input
              label="Contact Number"
              name="phone"
              defaultValue={settings?.phone ?? ""}
              placeholder="+91 …"
            />
            <Input
              label="Tax Number"
              name="gstin"
              defaultValue={settings?.gstin ?? ""}
              placeholder="GSTIN / VAT / Tax ID"
            />
            <Select
              label="Currency"
              name="currency"
              defaultValue={settings?.currency ?? "INR"}
              required
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card title="Defaults">
          <div className="grid max-w-3xl gap-4 md:grid-cols-2">
            <Input
              label="Default Making Charge %"
              name="makingChargePct"
              type="number"
              step="0.1"
              defaultValue={settings?.makingChargePct ?? 12}
            />
            <Input
              label="Default Wastage %"
              name="wastagePct"
              type="number"
              step="0.1"
              defaultValue={settings?.wastagePct ?? 2}
            />
            <Input
              label="Default Tax %"
              name="taxPct"
              type="number"
              step="0.1"
              min="0"
              defaultValue={settings?.taxPct ?? 3}
            />
            <Input
              label="Default Staff Commission %"
              name="commissionPct"
              type="number"
              step="0.1"
              min="0"
              defaultValue={settings?.commissionPct ?? 1}
            />
          </div>
        </Card>

        <Card title="Inventory security">
          <div className="grid max-w-3xl gap-4 md:grid-cols-2">
            <Select
              label="Dual auth for status adjustments"
              name="dualAuthAdjustments"
              defaultValue={settings?.dualAuthAdjustments === false ? "0" : "1"}
            >
              <option value="1">Required (Owner/Manager approver)</option>
              <option value="0">Off</option>
            </Select>
            <Select
              label="Dual auth for transfer approval"
              name="dualAuthTransfers"
              defaultValue={settings?.dualAuthTransfers === false ? "0" : "1"}
            >
              <option value="1">Required (second Owner/Manager)</option>
              <option value="0">Off</option>
            </Select>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Sensitive stock changes write an append-only audit log that staff cannot erase from the
            app.
          </p>
        </Card>

        <Button type="submit">Save Settings</Button>
      </form>

      {showBackup ? (
        <div className="mt-8">
          <Card title="Backup & restore">
            <BackupRestorePanel />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
