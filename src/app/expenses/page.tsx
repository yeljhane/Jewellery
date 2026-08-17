import { createExpense } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const expenses = await prisma.expense.findMany({ orderBy: { expenseDate: "desc" } });
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader
        title="Expenses"
        description={`Operating costs. Recorded total: ${formatCurrency(total)}.`}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Add Expense" className="lg:col-span-1">
          <form action={createExpense} className="space-y-3">
            <Select label="Category" name="category" defaultValue="OTHER">
              <option value="RENT">Rent</option>
              <option value="UTILITIES">Utilities</option>
              <option value="SALARY">Salary</option>
              <option value="MARKETING">Marketing</option>
              <option value="TRANSPORT">Transport</option>
              <option value="OTHER">Other</option>
            </Select>
            <Input label="Description" name="description" required />
            <Input label="Amount" name="amount" type="number" step="0.01" required />
            <Input label="Date" name="expenseDate" type="date" />
            <Select label="Payment" name="paymentMethod" defaultValue="CASH">
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK">Bank</option>
            </Select>
            <Textarea label="Notes" name="notes" rows={2} />
            <Button type="submit">Save Expense</Button>
          </form>
        </Card>
        <Card title="Ledger" className="lg:col-span-2">
          {expenses.length === 0 ? (
            <EmptyState title="No expenses" />
          ) : (
            <DataTable headers={["Date", "Category", "Description", "Payment", "Amount"]}>
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-stone-50/80">
                  <td className="px-3 py-3 text-[var(--muted)]">{formatDate(e.expenseDate)}</td>
                  <td className="px-3 py-3">
                    <Badge tone="neutral">{e.category}</Badge>
                  </td>
                  <td className="px-3 py-3">{e.description}</td>
                  <td className="px-3 py-3">{e.paymentMethod}</td>
                  <td className="px-3 py-3 font-medium">{formatCurrency(e.amount)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
