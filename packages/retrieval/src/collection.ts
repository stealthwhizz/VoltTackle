import type { QdrantClient } from "@qdrant/js-client-rest";
import { MEMORY_COLLECTION } from "./client.js";

export async function ensureMemoryCollection(client: QdrantClient, vectorSize: number): Promise<void> {
  const { collections } = await client.getCollections();
  const exists = collections.some((c) => c.name === MEMORY_COLLECTION);
  if (exists) return;

  await client.createCollection(MEMORY_COLLECTION, {
    vectors: { size: vectorSize, distance: "Cosine" },
  });

  await client.createPayloadIndex(MEMORY_COLLECTION, { field_name: "sourceType", field_schema: "keyword" });
  await client.createPayloadIndex(MEMORY_COLLECTION, { field_name: "service", field_schema: "keyword" });
  await client.createPayloadIndex(MEMORY_COLLECTION, { field_name: "incidentCategory", field_schema: "keyword" });
}
