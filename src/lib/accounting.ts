import { prisma } from "./prisma";
import { isFinishedStockPurchase } from "./txn-types";

export const ACCOUNT_CODES = {
  CASH: "1000",
  BANK: "1010",
  AR: "1100",
  INV_FG: "1200",
  INV_RM: "1210",
  GST_INPUT: "1300",
  AP: "2000",
  GST_OUTPUT: "2100",
  CAPITAL: "3000",
  RETAINED: "3100",
  SALES: "4000",
  MAKING_INCOME: "4100",
  OTHER_INCOME: "4200",
  COGS: "5000",
  PURCHASES: "5010",
  LABOUR: "5100",
  RENT: "5200",
  UTILITIES: "5300",
  SALARY: "5400",
  MARKETING: "5500",
  TRANSPORT: "5600",
  OTHER_EXPENSE: "5700",
} as const;

const CHART: Array<{
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  groupName: string;
}> = [
  { code: "1000", name: "Cash on Hand", type: "ASSET", groupName: "Current Assets" },
  { code: "1010", name: "Bank Account", type: "ASSET", groupName: "Current Assets" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET", groupName: "Current Assets" },
  { code: "1200", name: "Inventory — Finished Goods", type: "ASSET", groupName: "Inventory" },
  { code: "1210", name: "Inventory — Raw Materials", type: "ASSET", groupName: "Inventory" },
  { code: "1300", name: "GST Input Credit", type: "ASSET", groupName: "Current Assets" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", groupName: "Current Liabilities" },
  { code: "2100", name: "GST Output Payable", type: "LIABILITY", groupName: "Current Liabilities" },
  { code: "3000", name: "Owner's Capital", type: "EQUITY", groupName: "Equity" },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", groupName: "Equity" },
  { code: "4000", name: "Sales — Jewellery", type: "INCOME", groupName: "Revenue" },
  { code: "4100", name: "Making Charges Income", type: "INCOME", groupName: "Revenue" },
  { code: "4200", name: "Other Income", type: "INCOME", groupName: "Revenue" },
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE", groupName: "Cost of Sales" },
  { code: "5010", name: "Purchases — Materials", type: "EXPENSE", groupName: "Cost of Sales" },
  { code: "5100", name: "Labour / Karigar", type: "EXPENSE", groupName: "Operating Expenses" },
  { code: "5200", name: "Rent Expense", type: "EXPENSE", groupName: "Operating Expenses" },
  { code: "5300", name: "Utilities Expense", type: "EXPENSE", groupName: "Operating Expenses" },
  { code: "5400", name: "Salary Expense", type: "EXPENSE", groupName: "Operating Expenses" },
  { code: "5500", name: "Marketing Expense", type: "EXPENSE", groupName: "Operating Expenses" },
  { code: "5600", name: "Transport Expense", type: "EXPENSE", groupName: "Operating Expenses" },
  { code: "5700", name: "Other Expenses", type: "EXPENSE", groupName: "Operating Expenses" },
];

export async function ensureChartOfAccounts() {
  for (const a of CHART) {
    await prisma.account.upsert({
      where: { code: a.code },
      create: a,
      update: { name: a.name, type: a.type, groupName: a.groupName },
    });
  }
}

async function accountIdByCode(code: string) {
  const acc = await prisma.account.findUnique({ where: { code } });
  if (!acc) throw new Error(`Account ${code} missing. Run ensureChartOfAccounts.`);
  return acc.id;
}

async function nextJournalNumber() {
  const year = new Date().getFullYear().toString().slice(-2);
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 90 + 10);
  return `JV${year}${stamp}${rand}`;
}

export function cashOrBank(method: string) {
  const m = method.toUpperCase();
  if (m === "BANK" || m === "UPI" || m === "CARD") return ACCOUNT_CODES.BANK;
  return ACCOUNT_CODES.CASH;
}

/** Collection against open receivable — Dr Cash/Bank, Cr AR */
export async function postReceivableCollectionJournal(opts: {
  paymentId: string;
  invoiceNumber: string;
  amount: number;
  method: string;
  entryDate?: Date;
}) {
  const code = cashOrBank(opts.method);
  return postJournal({
    entryDate: opts.entryDate ?? new Date(),
    narration: `Collection ${opts.invoiceNumber}`,
    sourceType: "SALE_PAYMENT",
    sourceId: opts.paymentId,
    lines: [
      { code, debit: opts.amount, memo: `Udhaar collection (${opts.method})` },
      { code: ACCOUNT_CODES.AR, credit: opts.amount, memo: "AR cleared" },
    ],
  });
}

export async function deleteJournalsBySourceIds(sourceType: string, sourceIds: string[]) {
  if (sourceIds.length === 0) return;
  await prisma.journalEntry.deleteMany({
    where: { sourceType, sourceId: { in: sourceIds } },
  });
}

export async function deleteJournalBySource(sourceType: string, sourceId: string) {
  const existing = await prisma.journalEntry.findFirst({
    where: { sourceType, sourceId },
  });
  if (!existing) return null;
  await prisma.journalEntry.delete({ where: { id: existing.id } });
  return existing;
}

export async function postJournal(opts: {
  entryDate?: Date;
  narration: string;
  sourceType?: string;
  sourceId?: string;
  lines: Array<{ code: string; debit?: number; credit?: number; memo?: string }>;
}) {
  const debitTotal = opts.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const creditTotal = opts.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(debitTotal - creditTotal) > 0.05) {
    throw new Error(`Unbalanced journal: Dr ${debitTotal} != Cr ${creditTotal}`);
  }
  if (debitTotal === 0) return null;

  if (opts.sourceType && opts.sourceId) {
    const existing = await prisma.journalEntry.findFirst({
      where: { sourceType: opts.sourceType, sourceId: opts.sourceId },
    });
    if (existing) return existing;
  }

  await ensureChartOfAccounts();
  const entryNumber = await nextJournalNumber();
  const lines = [];
  for (const line of opts.lines) {
    if (!(line.debit || line.credit)) continue;
    lines.push({
      accountId: await accountIdByCode(line.code),
      debit: line.debit || 0,
      credit: line.credit || 0,
      memo: line.memo,
    });
  }

  return prisma.journalEntry.create({
    data: {
      entryNumber,
      entryDate: opts.entryDate ?? new Date(),
      narration: opts.narration,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
      lines: { create: lines },
    },
  });
}

export async function postSaleJournal(sale: {
  id: string;
  invoiceNumber: string;
  saleDate: Date;
  subtotal: number;
  makingCharges: number;
  taxAmount: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  txnType?: string | null;
  payments?: Array<{ method: string; amount: number }> | null;
}) {
  const isReturn = Boolean(sale.txnType?.endsWith("_RETURN"));
  const paymentRows =
    sale.payments && sale.payments.length > 0
      ? sale.payments.filter((p) => p.amount > 0)
      : sale.paidAmount > 0
        ? [{ method: sale.paymentMethod || "CASH", amount: sale.paidAmount }]
        : [];
  const paidTotal = paymentRows.reduce((s, p) => s + p.amount, 0);
  const unpaid = Math.max(0, sale.totalAmount - paidTotal);
  const making = Math.max(0, sale.makingCharges);
  const tax = Math.max(0, sale.taxAmount);
  const discount = Math.max(0, sale.discount);
  const salesCredit = Math.max(0, sale.totalAmount + discount - tax - making);

  const flip = (line: { code: string; debit?: number; credit?: number; memo?: string }) =>
    isReturn
      ? {
          code: line.code,
          debit: line.credit || 0,
          credit: line.debit || 0,
          memo: line.memo,
        }
      : line;

  const lines: Array<{ code: string; debit?: number; credit?: number; memo?: string }> = [];

  // Aggregate split payments by cash vs bank account
  const byCode = new Map<string, number>();
  for (const p of paymentRows) {
    const code = cashOrBank(p.method);
    byCode.set(code, (byCode.get(code) || 0) + p.amount);
  }
  for (const [code, amount] of byCode) {
    lines.push(
      flip({
        code,
        debit: amount,
        memo:
          byCode.size > 1 || paymentRows.length > 1
            ? `Customer payment (${paymentRows
                .filter((p) => cashOrBank(p.method) === code)
                .map((p) => p.method)
                .join(", ")})`
            : "Customer payment",
      })
    );
  }

  if (unpaid > 0) {
    lines.push(flip({ code: ACCOUNT_CODES.AR, debit: unpaid, memo: "Outstanding" }));
  }
  if (discount > 0) {
    lines.push(flip({ code: ACCOUNT_CODES.OTHER_EXPENSE, debit: discount, memo: "Discount given" }));
  }
  if (salesCredit > 0) {
    lines.push(flip({ code: ACCOUNT_CODES.SALES, credit: salesCredit, memo: "Metal / goods" }));
  }
  if (making > 0) {
    lines.push(
      flip({
        code: ACCOUNT_CODES.MAKING_INCOME,
        credit: making,
        memo: "Making charges",
      })
    );
  }
  if (tax > 0) {
    lines.push(flip({ code: ACCOUNT_CODES.GST_OUTPUT, credit: tax, memo: "GST" }));
  }

  return postJournal({
    entryDate: sale.saleDate,
    narration: `${isReturn ? "Sales return" : "Sale"} ${sale.invoiceNumber}`,
    sourceType: "SALE",
    sourceId: sale.id,
    lines,
  });
}

export async function postPurchaseJournal(po: {
  id: string;
  poNumber: string;
  orderDate: Date;
  receivedDate?: Date | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  txnType?: string | null;
}) {
  const isReturn =
    Boolean(po.txnType?.endsWith("_RETURN"));
  const invCode = isFinishedStockPurchase(po.txnType || "")
    ? ACCOUNT_CODES.INV_FG
    : ACCOUNT_CODES.INV_RM;
  const invMemo =
    invCode === ACCOUNT_CODES.INV_FG
      ? isReturn
        ? "Finished stock returned"
        : "Finished stock received"
      : isReturn
        ? "Materials returned"
        : "Materials received";

  const lines = isReturn
    ? [
        { code: ACCOUNT_CODES.AP, debit: po.totalAmount, memo: "Supplier credit" },
        ...(po.taxAmount > 0
          ? [{ code: ACCOUNT_CODES.GST_INPUT, credit: po.taxAmount, memo: "GST input reverse" }]
          : []),
        { code: invCode, credit: po.subtotal, memo: invMemo },
      ]
    : [
        { code: invCode, debit: po.subtotal, memo: invMemo },
        ...(po.taxAmount > 0
          ? [{ code: ACCOUNT_CODES.GST_INPUT, debit: po.taxAmount, memo: "GST input" }]
          : []),
        { code: ACCOUNT_CODES.AP, credit: po.totalAmount, memo: "Supplier payable" },
      ];

  return postJournal({
    entryDate: po.receivedDate ?? po.orderDate,
    narration: `${isReturn ? "Purchase return" : "Purchase"} ${po.poNumber}`,
    sourceType: "PURCHASE",
    sourceId: po.id,
    lines,
  });
}

export async function postExpenseJournal(expense: {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: Date;
  paymentMethod: string;
}) {
  const map: Record<string, string> = {
    RENT: ACCOUNT_CODES.RENT,
    UTILITIES: ACCOUNT_CODES.UTILITIES,
    SALARY: ACCOUNT_CODES.SALARY,
    MARKETING: ACCOUNT_CODES.MARKETING,
    TRANSPORT: ACCOUNT_CODES.TRANSPORT,
    OTHER: ACCOUNT_CODES.OTHER_EXPENSE,
  };
  const expenseCode = map[expense.category] ?? ACCOUNT_CODES.OTHER_EXPENSE;
  return postJournal({
    entryDate: expense.expenseDate,
    narration: expense.description,
    sourceType: "EXPENSE",
    sourceId: expense.id,
    lines: [
      { code: expenseCode, debit: expense.amount },
      { code: cashOrBank(expense.paymentMethod), credit: expense.amount },
    ],
  });
}

/** Sync operational data into journals (idempotent by sourceId). */
let syncPromise: Promise<number> | null = null;

export async function syncAccountingFromOperations() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    try {
      await ensureChartOfAccounts();

      const [sales, purchases, expenses] = await Promise.all([
        prisma.sale.findMany({
          where: { status: { in: ["COMPLETED", "RETURNED"] } },
          include: { payments: true },
        }),
        prisma.purchaseOrder.findMany({ where: { status: "RECEIVED" } }),
        prisma.expense.findMany(),
      ]);

      for (const s of sales) await postSaleJournal(s);
      for (const p of purchases) await postPurchaseJournal(p);
      for (const e of expenses) await postExpenseJournal(e);

      return prisma.journalEntry.count();
    } finally {
      setTimeout(() => {
        syncPromise = null;
      }, 300);
    }
  })();
  return syncPromise;
}

export type AccountBalance = {
  id: string;
  code: string;
  name: string;
  type: string;
  groupName: string | null;
  debit: number;
  credit: number;
  balance: number; // positive = debit nature for assets/expenses; credit for liability/income/equity shown as credit
};

export async function getAccountBalances(asOf?: Date): Promise<AccountBalance[]> {
  await syncAccountingFromOperations();
  const accounts = await prisma.account.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    include: {
      lines: {
        where: asOf
          ? { journalEntry: { entryDate: { lte: asOf } } }
          : undefined,
        select: { debit: true, credit: true },
      },
    },
  });

  return accounts.map((a) => {
    const debit = a.lines.reduce((s, l) => s + l.debit, 0);
    const credit = a.lines.reduce((s, l) => s + l.credit, 0);
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      groupName: a.groupName,
      debit,
      credit,
      balance: debit - credit,
    };
  });
}

export async function getTrialBalance(from?: Date, to?: Date) {
  await syncAccountingFromOperations();
  const asOf = to;
  // Period TB when from is set: show net movement in range; else closing as-of balances
  const accounts = await prisma.account.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    include: {
      lines: {
        where:
          from || asOf
            ? {
                journalEntry: {
                  entryDate: {
                    ...(from ? { gte: from } : {}),
                    ...(asOf ? { lte: asOf } : {}),
                  },
                },
              }
            : undefined,
        select: { debit: true, credit: true },
      },
    },
  });

  const rows = accounts
    .map((a) => {
      const debit = a.lines.reduce((s, l) => s + l.debit, 0);
      const credit = a.lines.reduce((s, l) => s + l.credit, 0);
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        groupName: a.groupName,
        debit,
        credit,
        balance: debit - credit,
        trialDebit: debit > credit ? debit - credit : 0,
        trialCredit: credit > debit ? credit - debit : 0,
      };
    })
    .filter((b) => Math.abs(b.debit) > 0.001 || Math.abs(b.credit) > 0.001);

  const totalDebit = rows.reduce((s, r) => s + r.trialDebit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.trialCredit, 0);
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 1 };
}

export async function getProfitAndLoss(from?: Date, to?: Date) {
  await syncAccountingFromOperations();
  const lines = await prisma.journalLine.findMany({
    where: {
      account: { type: { in: ["INCOME", "EXPENSE"] } },
      ...(from || to
        ? {
            journalEntry: {
              entryDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            },
          }
        : {}),
    },
    include: { account: true },
  });

  const map = new Map<string, AccountBalance>();
  for (const line of lines) {
    const key = line.accountId;
    const cur = map.get(key) ?? {
      id: line.account.id,
      code: line.account.code,
      name: line.account.name,
      type: line.account.type,
      groupName: line.account.groupName,
      debit: 0,
      credit: 0,
      balance: 0,
    };
    cur.debit += line.debit;
    cur.credit += line.credit;
    cur.balance = cur.debit - cur.credit;
    map.set(key, cur);
  }

  const income = [...map.values()]
    .filter((a) => a.type === "INCOME")
    .map((a) => ({ ...a, amount: a.credit - a.debit }))
    .filter((a) => Math.abs(a.amount) > 0.001)
    .sort((a, b) => a.code.localeCompare(b.code));

  const expenses = [...map.values()]
    .filter((a) => a.type === "EXPENSE")
    .map((a) => ({ ...a, amount: a.debit - a.credit }))
    .filter((a) => Math.abs(a.amount) > 0.001)
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalIncome = income.reduce((s, a) => s + a.amount, 0);
  const totalExpenses = expenses.reduce((s, a) => s + a.amount, 0);
  return {
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
  };
}

export async function getBalanceSheet(asOf?: Date, from?: Date) {
  const balances = await getAccountBalances(asOf);
  const pl = await getProfitAndLoss(from, asOf);

  const assets = balances
    .filter((a) => a.type === "ASSET")
    .map((a) => ({ ...a, amount: a.debit - a.credit }))
    .filter((a) => Math.abs(a.amount) > 0.001);

  const liabilities = balances
    .filter((a) => a.type === "LIABILITY")
    .map((a) => ({ ...a, amount: a.credit - a.debit }))
    .filter((a) => Math.abs(a.amount) > 0.001);

  const equity = balances
    .filter((a) => a.type === "EQUITY")
    .map((a) => ({ ...a, amount: a.credit - a.debit }))
    .filter((a) => Math.abs(a.amount) > 0.001);

  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.amount, 0);
  const totalEquity = equity.reduce((s, a) => s + a.amount, 0) + pl.netProfit;

  return {
    assets,
    liabilities,
    equity,
    netProfit: pl.netProfit,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
  };
}

export async function getDayBook(from?: Date, to?: Date) {
  await syncAccountingFromOperations();
  return prisma.journalEntry.findMany({
    where: {
      ...(from || to
        ? {
            entryDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: {
      lines: { include: { account: true }, orderBy: { debit: "desc" } },
    },
    orderBy: [{ entryDate: "desc" }, { entryNumber: "desc" }],
    take: 200,
  });
}

export async function getLedger(accountId: string, from?: Date, to?: Date) {
  await syncAccountingFromOperations();
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return null;

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId,
      ...(from || to
        ? {
            journalEntry: {
              entryDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            },
          }
        : {}),
    },
    include: { journalEntry: true },
    orderBy: { journalEntry: { entryDate: "asc" } },
  });

  let running = 0;
  const rows = lines.map((l) => {
    running += l.debit - l.credit;
    return {
      date: l.journalEntry.entryDate,
      entryNumber: l.journalEntry.entryNumber,
      narration: l.journalEntry.narration,
      debit: l.debit,
      credit: l.credit,
      balance: running,
    };
  });

  return { account, rows, closing: running };
}
