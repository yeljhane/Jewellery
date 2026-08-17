import Link from "next/link";
import { ensureChartOfAccounts } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { Badge, Card, DataTable, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
  await ensureChartOfAccounts();
  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });

  return (
    <div>
      <PageHeader
        title="Chart of Accounts"
        description="Standard ledger heads for jewellery retail and manufacturing."
        actions={
          <Link href="/accounting" className="text-sm text-[var(--gold-deep)] hover:underline">
            Accounting home
          </Link>
        }
      />
      <Card>
        <DataTable headers={["Code", "Account", "Type", "Group"]}>
          {accounts.map((a) => (
            <tr key={a.id} className="hover:bg-stone-50/80">
              <td className="px-3 py-3 font-mono text-xs">{a.code}</td>
              <td className="px-3 py-3 font-medium">{a.name}</td>
              <td className="px-3 py-3">
                <Badge
                  tone={
                    a.type === "ASSET"
                      ? "info"
                      : a.type === "INCOME"
                        ? "success"
                        : a.type === "EXPENSE"
                          ? "warn"
                          : "neutral"
                  }
                >
                  {a.type}
                </Badge>
              </td>
              <td className="px-3 py-3 text-[var(--muted)]">{a.groupName}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
