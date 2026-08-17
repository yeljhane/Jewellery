# Araz Jewellery ERP

Full-stack ERP for jewellery retail shops and manufacturing workshops.

## Modules

- **Dashboard** — revenue, stock, open jobs, live metal rates
- **Finished Stock** — tagged products with metal, purity, weight, making charges
- **Raw Materials** — bullion, stones, findings with vault locations
- **Manufacturing** — job cards, karigar issue/return, wastage, finished goods intake
- **Sales / POS** — invoices with rate × weight + making + stones + GST
- **Purchases** — supplier POs; receiving adds to raw materials
- **Customers / Suppliers / Karigars** — directories
- **Metal Rates** — daily board rates
- **Expenses** — shop operating costs
- **Settings** — shop profile, GSTIN, defaults

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4
- Prisma + SQLite

## Setup

**One-click (Windows):** double-click `START.bat` or `Run Araz Jewellery.bat`.

That installs dependencies (first time), prepares the database, starts the server, and opens http://localhost:3000.

Or from a terminal:

```bash
npm install
npm run db:setup
npm run app
```

Demo data is seeded under the brand **Araz Jewellery** (sample stock, jobs, sales, rates).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run db:push` | Sync Prisma schema to SQLite |
| `npm run db:seed` | Load demo data |
| `npm run db:setup` | Push schema + seed |
| `npm run build` | Production build |
