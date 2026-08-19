import Link from "next/link";
import { createMarketingCampaign, sendMarketingCampaign } from "@/lib/jewelry-pos-actions";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { SendCampaignButton } from "@/components/SendCampaignButton";
import { ActionForm } from "@/components/ActionForm";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "SENT") return "success" as const;
  if (status === "PARTIAL" || status === "SENDING") return "warn" as const;
  if (status === "FAILED") return "danger" as const;
  return "neutral" as const;
}

export default async function MarketingPage() {
  const [campaigns, optedInWithEmail, vipWithEmail] = await Promise.all([
    prisma.marketingCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.customer.count({
      where: { marketingOptIn: true, email: { not: null } },
    }),
    prisma.customer.count({
      where: { marketingOptIn: true, vipTier: { not: "STANDARD" }, email: { not: null } },
    }),
  ]);
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      (process.env.SMTP_FROM || process.env.SMTP_USER)
  );

  return (
    <div>
      <PageHeader
        title="Email Marketing"
        description={`Send collection brochures privately to opted-in clients · ${optedInWithEmail} email contacts, ${vipWithEmail} VIP.`}
      />

      <div
        className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
          smtpConfigured
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        {smtpConfigured ? (
          <span>Email delivery is configured. Each customer receives an individual message.</span>
        ) : (
          <span>
            Drafts and brochures are available, but live delivery needs SMTP settings in the app’s
            <code className="mx-1 rounded bg-white/70 px-1.5 py-0.5 text-xs">.env</code>
            file. Copy the variable names from
            <code className="ml-1 rounded bg-white/70 px-1.5 py-0.5 text-xs">.env.example</code>
            and restart the app.
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="New Collection Email" className="lg:col-span-1">
          <ActionForm action={createMarketingCampaign} successMessage="The email campaign was added successfully." className="space-y-3" encType="multipart/form-data">
            <Input
              label="Campaign name"
              name="name"
              placeholder="Autumn Diamond Collection"
              required
            />
            <Select label="Audience" name="audience" defaultValue="OPTED_IN">
              <option value="OPTED_IN">All opted-in customers</option>
              <option value="VIP">VIP customers only</option>
            </Select>
            <Input
              label="Email subject"
              name="subject"
              placeholder="Discover our new collection"
              required
            />
            <Textarea
              label="Email message"
              name="body"
              rows={6}
              placeholder="Write a personal introduction to the collection…"
              required
            />
            <Input
              label="PDF or brochure image"
              name="brochure"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
            <p className="text-xs leading-5 text-[var(--muted)]">
              Optional PDF, JPG, PNG or WebP attachment. Maximum 15 MB.
            </p>
            <Button type="submit">Save Draft</Button>
          </ActionForm>
        </Card>

        <Card title="Email Campaigns" className="lg:col-span-2">
          {campaigns.length === 0 ? (
            <EmptyState
              title="No email campaigns"
              description="Create a draft and attach the latest jewellery collection brochure."
            />
          ) : (
            <DataTable headers={["Campaign", "Audience", "Brochure", "Status", "Delivery", ""]}>
              {campaigns.map((campaign) => {
                const recipientCount = campaign.audience === "VIP" ? vipWithEmail : optedInWithEmail;
                const canSend =
                  campaign.channel === "EMAIL" &&
                  (campaign.status === "DRAFT" ||
                    (campaign.status === "FAILED" && campaign.sentCount === 0));

                return (
                  <tr key={campaign.id} className="border-t border-[var(--border)] align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium">{campaign.name}</p>
                      <p className="mt-0.5 max-w-[220px] truncate text-xs text-[var(--muted)]">
                        {campaign.subject || "No subject"}
                      </p>
                      {campaign.lastError ? (
                        <p className="mt-1 max-w-[260px] whitespace-pre-line text-xs text-red-700">
                          {campaign.lastError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {campaign.audience === "VIP" ? "VIP only" : "Opted-in"}
                      <p className="text-[var(--muted)]">{recipientCount} eligible</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {campaign.attachmentUrl ? (
                        <Link
                          href={campaign.attachmentUrl}
                          target="_blank"
                          className="text-[var(--gold-deep)] hover:underline"
                        >
                          {campaign.attachmentName || "Open brochure"}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">None</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone(campaign.status)}>{campaign.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <span className="text-emerald-700">{campaign.sentCount} sent</span>
                      {campaign.failedCount > 0 ? (
                        <p className="text-red-700">{campaign.failedCount} failed</p>
                      ) : null}
                      {campaign.sentAt ? (
                        <p className="text-[var(--muted)]">{campaign.sentAt.toLocaleDateString()}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {canSend ? (
                        <ActionForm action={sendMarketingCampaign} successTitle="Campaign sent" successMessage="The email campaign delivery was completed.">
                          <input type="hidden" name="id" value={campaign.id} />
                          <SendCampaignButton
                            recipientCount={recipientCount}
                            retry={campaign.status === "FAILED"}
                            disabled={!smtpConfigured || recipientCount === 0}
                          />
                        </ActionForm>
                      ) : campaign.channel !== "EMAIL" ? (
                        <span className="text-xs text-[var(--muted)]">Legacy SMS draft</span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
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
