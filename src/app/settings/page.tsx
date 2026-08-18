import { updateSettings } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOwnerOrManager } from "@/lib/permissions";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { CompanyLogoField } from "@/components/CompanyLogoField";
import { BackupRestorePanel } from "@/components/BackupRestorePanel";
import { LANGUAGE_OPTIONS } from "@/lib/localization";

export const dynamic = "force-dynamic";

const CURRENCIES = [
  { value: "AZN", label: "AZN — Azərbaycan manatı" },
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

      <form action={updateSettings} className="space-y-6">
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
              defaultValue={settings?.currency ?? "AZN"}
              required
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Select
              label="Interface language"
              name="interfaceLanguage"
              defaultValue={settings?.interfaceLanguage ?? "EN"}
              required
            >
              {LANGUAGE_OPTIONS.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card title="Customer-service SLA">
          <div className="grid max-w-3xl gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Input label="Critical hours" name="slaCriticalHours" type="number" min="1" defaultValue={settings?.slaCriticalHours ?? 4} />
            <Input label="High hours" name="slaHighHours" type="number" min="1" defaultValue={settings?.slaHighHours ?? 8} />
            <Input label="Normal hours" name="slaNormalHours" type="number" min="1" defaultValue={settings?.slaNormalHours ?? 24} />
            <Input label="Low hours" name="slaLowHours" type="number" min="1" defaultValue={settings?.slaLowHours ?? 72} />
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            New complaints, enquiries, and service tickets receive an automatic deadline based on priority.
          </p>
        </Card>

        <Card title="Azerbaijan tourist VAT refund">
          <div className="grid max-w-3xl gap-4 md:grid-cols-2">
            <Select
              label="Workflow"
              name="touristVatRefundEnabled"
              defaultValue={settings?.touristVatRefundEnabled === false ? "0" : "1"}
            >
              <option value="1">Enabled</option>
              <option value="0">Disabled</option>
            </Select>
            <Select
              label="Tax-free merchant registration"
              name="taxFreeMerchantRegistered"
              defaultValue={settings?.taxFreeMerchantRegistered ? "1" : "0"}
            >
              <option value="1">Registered and authorized</option>
              <option value="0">Not yet registered</option>
            </Select>
            <Input
              label="Minimum eligible invoice (AZN)"
              name="vatRefundMinSale"
              type="number"
              min="0"
              step="0.01"
              defaultValue={settings?.vatRefundMinSale ?? 300}
            />
            <Input
              label="Operator service fee (% of VAT)"
              name="vatRefundFeePct"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={settings?.vatRefundFeePct ?? 20}
            />
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Set the current statutory or provider threshold here. The workflow records eligibility, validation, payment, and an immutable event history; your compliance team remains responsible for current legal rules.
          </p>
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
              defaultValue={settings?.taxPct ?? 18}
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
