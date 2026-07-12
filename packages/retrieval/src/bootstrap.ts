import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../apps/api/.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { prisma } = await import("@volt-tackle/database");
const { createEmbeddingsProvider } = await import("@volt-tackle/providers");
const { createQdrantClient } = await import("./client.js");
const { ensureMemoryCollection } = await import("./collection.js");
const { upsertMemoryPoints } = await import("./upsert.js");
const { runbookToMemoryPoint, documentToMemoryPoint, incidentToMemoryPoint, postmortemToMemoryPoint } = await import(
  "./mappers.js"
);

async function main() {
  const embeddingsProvider = createEmbeddingsProvider({
    provider: (process.env.EMBEDDINGS_PROVIDER as "openai" | "mock") ?? "mock",
    openaiApiKey: process.env.OPENAI_API_KEY,
  });
  const qdrant = createQdrantClient({ url: process.env.QDRANT_URL ?? "http://localhost:6333", apiKey: process.env.QDRANT_API_KEY });

  console.log(`Using embeddings provider: ${embeddingsProvider.name} (dim=${embeddingsProvider.dimensions})`);
  await ensureMemoryCollection(qdrant, embeddingsProvider.dimensions);

  const [runbooks, documents, resolvedIncidents, postmortems] = await Promise.all([
    prisma.runbookSource.findMany(),
    prisma.documentSource.findMany(),
    prisma.incident.findMany({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
    prisma.postmortem.findMany({ where: { status: "FINALIZED" }, include: { incident: true } }),
  ]);

  const points = [
    ...runbooks.map(runbookToMemoryPoint),
    ...documents.map(documentToMemoryPoint),
    ...resolvedIncidents.map(incidentToMemoryPoint),
    ...postmortems.map((pm) => postmortemToMemoryPoint(pm, pm.incident)),
  ];

  console.log(`Indexing ${points.length} points (${runbooks.length} runbooks, ${documents.length} docs, ${resolvedIncidents.length} incidents, ${postmortems.length} postmortems)...`);

  const BATCH_SIZE = 16;
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    await upsertMemoryPoints(qdrant, embeddingsProvider, points.slice(i, i + BATCH_SIZE));
  }

  await prisma.$transaction([
    ...runbooks.map((r) => prisma.runbookSource.update({ where: { id: r.id }, data: { qdrantPointId: r.id } })),
    ...documents.map((d) => prisma.documentSource.update({ where: { id: d.id }, data: { qdrantPointId: d.id } })),
  ]);

  console.log("Qdrant bootstrap complete.");
}

main()
  .catch((err) => {
    console.error("Qdrant bootstrap failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("@volt-tackle/database");
    await prisma.$disconnect();
  });
