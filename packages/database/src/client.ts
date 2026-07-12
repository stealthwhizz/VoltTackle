import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __voltTacklePrisma: PrismaClient | undefined;
}

/**
 * Single shared PrismaClient instance per process. Reused across hot reloads
 * in dev to avoid exhausting Postgres connections.
 */
export const prisma = globalThis.__voltTacklePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__voltTacklePrisma = prisma;
}
