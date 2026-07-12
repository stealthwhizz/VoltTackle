import type { QdrantClient } from "@qdrant/js-client-rest";
import type { EmbeddingsProvider } from "@volt-tackle/providers";
import type { RetrievalPayload } from "@volt-tackle/shared";
import { MEMORY_COLLECTION } from "./client.js";

export interface MemoryPointInput {
  id: string;
  embeddingText: string;
  payload: RetrievalPayload;
}

export async function upsertMemoryPoint(
  client: QdrantClient,
  embeddingsProvider: EmbeddingsProvider,
  point: MemoryPointInput,
): Promise<void> {
  const vector = await embeddingsProvider.embed(point.embeddingText);
  await client.upsert(MEMORY_COLLECTION, {
    wait: true,
    points: [{ id: point.id, vector, payload: point.payload }],
  });
}

export async function upsertMemoryPoints(
  client: QdrantClient,
  embeddingsProvider: EmbeddingsProvider,
  points: MemoryPointInput[],
): Promise<void> {
  if (points.length === 0) return;
  const vectors = await embeddingsProvider.embedBatch(points.map((p) => p.embeddingText));
  await client.upsert(MEMORY_COLLECTION, {
    wait: true,
    points: points.map((p, i) => ({ id: p.id, vector: vectors[i] as number[], payload: p.payload })),
  });
}
