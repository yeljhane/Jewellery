import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.saleItem.deleteMany();
  await prisma.salePayment.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.jobMaterial.deleteMany();
  await prisma.manufacturingJob.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.product.deleteMany();
  await prisma.rawMaterial.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.metalRate.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.karigar.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.shopSettings.deleteMany();

  await prisma.shopSettings.create({
    data: {
      shopName: "Avenue JOAILLERIE",
      address: "12 Gold Street, Jewellery Market, Mumbai 400001",
      phone: "+91 98765 43210",
      email: "hello@avenuejoaillerie.com",
      gstin: "27AABCU9603R1ZM",
      currency: "INR",
      makingChargePct: 12,
      wastagePct: 2,
      taxPct: 3,
      commissionPct: 1,
      dualAuthAdjustments: true,
      dualAuthTransfers: true,
    },
  });

  await prisma.metalRate.createMany({
    data: [
      { metal: "GOLD", purity: "24K", ratePerGram: 7250 },
      { metal: "GOLD", purity: "22K", ratePerGram: 6650 },
      { metal: "GOLD", purity: "18K", ratePerGram: 5440 },
      { metal: "SILVER", purity: "999", ratePerGram: 92 },
      { metal: "SILVER", purity: "925", ratePerGram: 85 },
      { metal: "PLATINUM", purity: "950", ratePerGram: 3200 },
    ],
  });

  const categories = await Promise.all(
    [
      "Gold Jewellery",
      "Diamond Jewellery",
      "Rings",
      "Necklaces",
      "Earrings",
      "Bangles",
      "Chains",
      "Pendants",
    ].map((name) => prisma.category.create({ data: { name } }))
  );

  const supplier = await prisma.supplier.create({
    data: {
      name: "Rajesh Bullion Traders",
      phone: "+91 98200 11111",
      address: "Zaveri Bazaar, Mumbai",
      gstin: "27AADCR1234A1Z5",
    },
  });

  await prisma.supplier.create({
    data: {
      name: "Diamond Hub Exports",
      phone: "+91 98300 22222",
      address: "Opera House, Mumbai",
    },
  });

  const customers = await Promise.all([
    prisma.customer.create({
      data: { name: "Priya Sharma", phone: "+91 90000 10001", email: "priya@email.com" },
    }),
    prisma.customer.create({
      data: { name: "Amit Patel", phone: "+91 90000 10002", address: "Andheri West" },
    }),
    prisma.customer.create({
      data: { name: "Meera Krishnan", phone: "+91 90000 10003" },
    }),
  ]);

  const karigar = await prisma.karigar.create({
    data: {
      name: "Ramesh Soni",
      phone: "+91 91111 20001",
      specialty: "Casting & Setting",
      dailyWage: 1200,
    },
  });

  await prisma.karigar.create({
    data: {
      name: "Suresh Mistry",
      phone: "+91 91111 20002",
      specialty: "Filigree & Polishing",
      dailyWage: 1000,
    },
  });

  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.employee.create({
    data: {
      name: "Avenue Owner",
      role: "OWNER",
      username: "admin",
      passwordHash: adminHash,
      phone: "+91 98765 43210",
      email: "owner@avenuejoaillerie.com",
    },
  });

  const salesHash = await bcrypt.hash("sales123", 10);
  const employee = await prisma.employee.create({
    data: {
      name: "Ananya Desai",
      role: "SALES",
      username: "sales",
      passwordHash: salesHash,
      phone: "+91 92222 30001",
      email: "ananya@avenuejoaillerie.com",
    },
  });

  const managerHash = await bcrypt.hash("manager123", 10);
  await prisma.employee.create({
    data: {
      name: "Vikram Mehta",
      role: "MANAGER",
      username: "manager",
      passwordHash: managerHash,
      phone: "+91 92222 30002",
    },
  });

  await prisma.employee.create({
    data: { name: "Kavita Joshi", role: "WORKSHOP", phone: "+91 92222 30003" },
  });

  const goldBar = await prisma.rawMaterial.create({
    data: {
      name: "22K Gold Bar",
      type: "METAL",
      metal: "GOLD",
      purity: "22K",
      weightGrams: 500,
      quantity: 500,
      unit: "g",
      costPerUnit: 6600,
      supplierId: supplier.id,
      location: "Safe A1",
    },
  });

  await prisma.rawMaterial.createMany({
    data: [
      {
        name: "18K Gold Scrap",
        type: "METAL",
        metal: "GOLD",
        purity: "18K",
        weightGrams: 120,
        quantity: 120,
        unit: "g",
        costPerUnit: 5400,
        supplierId: supplier.id,
        location: "Safe A2",
      },
      {
        name: "925 Silver Grain",
        type: "METAL",
        metal: "SILVER",
        purity: "925",
        weightGrams: 2000,
        quantity: 2000,
        unit: "g",
        costPerUnit: 82,
        location: "Safe B1",
      },
      {
        name: "Round Brilliant Diamonds",
        type: "STONE",
        weightGrams: 0,
        quantity: 25.5,
        unit: "ct",
        costPerUnit: 45000,
        location: "Vault C1",
      },
      {
        name: "Ruby Cabochons",
        type: "STONE",
        quantity: 40,
        unit: "pcs",
        costPerUnit: 2500,
        location: "Vault C2",
      },
    ],
  });

  const products = await Promise.all([
    prisma.product.create({
      data: {
        sku: "JW-00001",
        name: "Temple Necklace Set",
        categoryId: categories[3].id,
        jewelleryType: "GOLD",
        metal: "GOLD",
        purity: "22K",
        grossWeight: 48.5,
        netWeight: 46.2,
        stoneWeight: 2.3,
        stoneDetails: "Ruby & emerald accents",
        makingCharge: 18500,
        wastagePct: 2,
        costPrice: 320000,
        sellingPrice: 365000,
        quantity: 1,
        status: "IN_STOCK",
        imageUrl: "/products/temple-necklace.svg",
      },
    }),
    prisma.product.create({
      data: {
        sku: "JW-00002",
        name: "Solitaire Engagement Ring",
        categoryId: categories[2].id,
        jewelleryType: "DIAMOND",
        metal: "GOLD",
        purity: "18K",
        grossWeight: 4.8,
        netWeight: 4.2,
        stoneWeight: 0.6,
        stoneDetails: "1.02ct VS1 G diamond",
        makingCharge: 8500,
        wastagePct: 1.5,
        costPrice: 95000,
        sellingPrice: 128000,
        quantity: 2,
        status: "IN_STOCK",
        imageUrl: "/products/solitaire-ring.svg",
      },
    }),
    prisma.product.create({
      data: {
        sku: "JW-00003",
        name: "Classic Gold Bangles (Pair)",
        categoryId: categories[5].id,
        jewelleryType: "GOLD",
        metal: "GOLD",
        purity: "22K",
        grossWeight: 32.0,
        netWeight: 32.0,
        makingCharge: 9600,
        wastagePct: 2,
        costPrice: 215000,
        sellingPrice: 242000,
        quantity: 3,
        status: "IN_STOCK",
        imageUrl: "/products/gold-bangles.svg",
      },
    }),
    prisma.product.create({
      data: {
        sku: "JW-00004",
        name: "Silver Anklet Pair",
        categoryId: categories[6].id,
        jewelleryType: "GOLD",
        metal: "SILVER",
        purity: "925",
        grossWeight: 45.0,
        netWeight: 45.0,
        makingCharge: 1200,
        costPrice: 4200,
        sellingPrice: 5800,
        quantity: 8,
        status: "IN_STOCK",
        imageUrl: "/products/silver-anklet.svg",
      },
    }),
    prisma.product.create({
      data: {
        sku: "JW-00005",
        name: "Pearl Drop Earrings",
        categoryId: categories[4].id,
        jewelleryType: "GOLD",
        metal: "GOLD",
        purity: "18K",
        grossWeight: 6.5,
        netWeight: 5.8,
        stoneWeight: 0.7,
        stoneDetails: "Freshwater pearls",
        makingCharge: 4500,
        costPrice: 38000,
        sellingPrice: 48500,
        quantity: 4,
        status: "IN_STOCK",
        imageUrl: "/products/pearl-earrings.svg",
      },
    }),
    prisma.product.create({
      data: {
        sku: "JW-00006",
        name: "Diamond Halo Pendant",
        categoryId: categories[7].id,
        jewelleryType: "DIAMOND",
        metal: "GOLD",
        purity: "18K",
        grossWeight: 5.2,
        netWeight: 4.4,
        stoneWeight: 0.8,
        stoneDetails: "0.75ct diamond halo set",
        makingCharge: 7200,
        wastagePct: 1.5,
        costPrice: 88000,
        sellingPrice: 115000,
        quantity: 2,
        status: "IN_STOCK",
        imageUrl: "/products/diamond-pendant.svg",
      },
    }),
  ]);

  const job = await prisma.manufacturingJob.create({
    data: {
      jobNumber: "JOB2600001",
      productId: products[1].id,
      karigarId: karigar.id,
      status: "IN_PROGRESS",
      designName: "Custom Halo Ring",
      metal: "GOLD",
      purity: "18K",
      issuedWeight: 6.5,
      labourCost: 3500,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: "Customer custom order — matching band later",
    },
  });

  await prisma.jobMaterial.create({
    data: {
      jobId: job.id,
      rawMaterialId: goldBar.id,
      quantityUsed: 6.5,
    },
  });

  await prisma.manufacturingJob.create({
    data: {
      jobNumber: "JOB2600002",
      karigarId: karigar.id,
      status: "PENDING",
      designName: "Bridal Choker",
      metal: "GOLD",
      purity: "22K",
      issuedWeight: 0,
      labourCost: 12000,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      poNumber: "PO2600001",
      supplierId: supplier.id,
      txnType: "GOLD_PURCHASE",
      status: "RECEIVED",
      orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      receivedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      subtotal: 3300000,
      taxAmount: 99000,
      totalAmount: 3399000,
      items: {
        create: [
          {
            description: "22K Gold Bar 500g",
            metal: "GOLD",
            purity: "22K",
            weightGrams: 500,
            quantity: 1,
            rate: 6600,
            amount: 3300000,
          },
        ],
      },
    },
  });

  await prisma.sale.create({
    data: {
      invoiceNumber: "INV2600001",
      customerId: customers[0].id,
      employeeId: employee.id,
      txnType: "DIAMOND_SALE",
      status: "COMPLETED",
      saleDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      subtotal: 118500,
      makingCharges: 8500,
      taxAmount: 3555,
      discount: 2000,
      totalAmount: 128555,
      paidAmount: 128555,
      paymentMethod: "UPI",
      items: {
        create: [
          {
            productId: products[1].id,
            description: "Solitaire Engagement Ring",
            metal: "GOLD",
            purity: "18K",
            netWeight: 4.2,
            quantity: 1,
            metalRate: 5440,
            makingCharge: 8500,
            stoneCharge: 85000,
            amount: 128555,
          },
        ],
      },
    },
  });

  await prisma.sale.create({
    data: {
      invoiceNumber: "INV2600002",
      customerId: customers[1].id,
      employeeId: employee.id,
      txnType: "GOLD_SALE",
      status: "COMPLETED",
      subtotal: 232400,
      makingCharges: 9600,
      taxAmount: 7260,
      totalAmount: 249260,
      paidAmount: 249260,
      paymentMethod: "CARD",
      items: {
        create: [
          {
            productId: products[2].id,
            description: "Classic Gold Bangles (Pair)",
            metal: "GOLD",
            purity: "22K",
            netWeight: 32.0,
            quantity: 1,
            metalRate: 6650,
            makingCharge: 9600,
            amount: 249260,
          },
        ],
      },
    },
  });

  await prisma.expense.createMany({
    data: [
      {
        category: "RENT",
        description: "Shop rent — July",
        amount: 85000,
        paymentMethod: "BANK",
      },
      {
        category: "UTILITIES",
        description: "Electricity & AC",
        amount: 12500,
        paymentMethod: "UPI",
      },
      {
        category: "SALARY",
        description: "Staff salaries — July",
        amount: 145000,
        paymentMethod: "BANK",
      },
    ],
  });

  console.log("Seed complete: Avenue JOAILLERIE ERP demo data loaded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
