import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedUsers, DEMO_PASSWORD } from "./users.js";
import { seedRunbooks } from "./runbooks.js";
import { seedDocuments } from "./documents.js";
import { seedHistoricalIncidents } from "./incidents.js";
import { seedPromptVersions } from "./promptVersions.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding users...");
  const users = await seedUsers(prisma);
  console.log(`  -> ${users.length} users (demo password: "${DEMO_PASSWORD}")`);

  console.log("Seeding runbooks...");
  const runbooks = await seedRunbooks(prisma);
  console.log(`  -> ${runbooks.length} runbooks`);

  console.log("Seeding service documents...");
  const docs = await seedDocuments(prisma);
  console.log(`  -> ${docs.length} documents`);

  console.log("Seeding historical incidents + postmortems...");
  const historical = await seedHistoricalIncidents(prisma);
  console.log(`  -> ${historical.length} historical incidents`);

  console.log("Registering prompt versions...");
  const prompts = await seedPromptVersions(prisma);
  console.log(`  -> ${prompts.length} prompt versions registered`);

  console.log("\nSeed complete. Run `npm run qdrant:bootstrap` to index runbooks/docs/postmortems into Qdrant.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
