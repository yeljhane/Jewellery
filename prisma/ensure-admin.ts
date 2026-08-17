import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("admin123", 10);
  const existing = await prisma.employee.findFirst({ where: { username: "admin" } });
  if (existing) {
    await prisma.employee.update({
      where: { id: existing.id },
      data: { passwordHash: hash, active: true, role: "OWNER" },
    });
    console.log("Updated admin");
  } else {
    await prisma.employee.create({
      data: {
        name: "Avenue Owner",
        role: "OWNER",
        username: "admin",
        passwordHash: hash,
        email: "owner@avenuejoaillerie.com",
      },
    });
    console.log("Created admin");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
