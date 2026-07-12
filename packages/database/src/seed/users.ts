import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

export const DEMO_PASSWORD = "volttackle-demo";

export async function seedUsers(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users = [
    { email: "oncall.engineer@volttackle.dev", name: "Priya Nair", role: "ENGINEER" as const },
    { email: "senior.engineer@volttackle.dev", name: "Marcus Idowu", role: "SENIOR_ENGINEER" as const },
    { email: "admin@volttackle.dev", name: "Sam Reyes", role: "ADMIN" as const },
  ];

  const created = [];
  for (const user of users) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: { ...user, passwordHash },
    });
    created.push(record);
  }

  return created;
}
