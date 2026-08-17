import {
  createMarketingCampaign,
  sendMarketingCampaign,
} from "@/lib/jewelry-pos-actions";
import { prisma } from "@/lib/prisma";
import { Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const [campaigns, optedIn, vipCount] = await Promise.all([
    prisma.marketingCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.customer.count({ where: { marketingOptIn: true } }),
    prisma.customer.count({
      where: { marketingOptIn: true, vipTier: { not: "STANDARD" } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="SMS & Email Marketing"
        description={`Reach opted-in clients (${optedIn} contacts, ${vipCount} VIP). Sends are logged here; connect a provider later for live delivery.`}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="New Campaign" className="lg:col-span-1">
          <form action={createMarketingCampaign} className="space-y-3">
            <Input label="Campaign name" name="name" required />
            <Select label="Channel" name="channel" defaultValue="EMAIL">
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
            </Select>
            <Select label="Audience" name="audience" defaultValue="OPTED_IN">
              <option value="OPTED_IN">Opted-in</option>
              <option value="VIP">VIP only</option>
              <option value="ALL">All opted-in</option>
            </Select>
            <Input label="Subject (email)" name="subject" />
            <Textarea label="Message body" name="body" rows={5} required />
            <Button type="submit">Save Draft</Button>
          </form>
        </Card>
        <Card title="Campaigns" className="lg:col-span-2">
          {campaigns.length === 0 ? (
            <EmptyState title="No campaigns" description="Draft an SMS or email to VIP or opted-in clients." />
          ) : (
            <DataTable headers={["Name", "Channel", "Audience", "Status", "Sent", ""]}>
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3">{c.channel}</td>
                  <td className="px-3 py-3">{c.audience.replaceAll("_", " ")}</td>
                  <td className="px-3 py-3">{c.status}</td>
                  <td className="px-3 py-3">{c.status === "SENT" ? String(c.sentCount) : "—"}</td>
                  <td className="px-3 py-3">
                    {c.status === "DRAFT" ? (
                      <form action={sendMarketingCampaign}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button type="submit" variant="secondary" className="!py-1 !text-xs">
                          Mark sent
                        </Button>
                      </form>
                    ) : (
                      c.sentAt?.toLocaleDateString() || "—"
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
