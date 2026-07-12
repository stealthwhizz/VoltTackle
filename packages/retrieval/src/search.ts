import type { QdrantClient } from "@qdrant/js-client-rest";
import type { EmbeddingsProvider } from "@volt-tackle/providers";
import type { RetrievalMatch, SourceType } from "@volt-tackle/shared";
import { MEMORY_COLLECTION } from "./client.js";

export interface SearchMemoryOptions {
  queryText: string;
  limit?: number;
  sourceTypes?: SourceType[];
  service?: string;
}

export async function searchMemory(
  client: QdrantClient,
  embeddingsProvider: EmbeddingsProvider,
  options: SearchMemoryOptions,
): Promise<RetrievalMatch[]> {
  const vector = await embeddingsProvider.embed(options.queryText);

  const must: Array<Record<string, unknown>> = [];
  if (options.sourceTypes?.length) {
    must.push({ key: "sourceType", match: { any: options.sourceTypes } });
  }
  if (options.service) {
    must.push({ key: "service", match: { value: options.service } });
  }

  const result = await client.query(MEMORY_COLLECTION, {
    query: vector,
    filter: must.length > 0 ? { must } : undefined,
    with_payload: true,
    limit: options.limit ?? 5,
  });

  return result.points.map((point) => {
    const payload = point.payload as Record<string, unknown>;
    return {
      id: String(point.id),
      score: point.score,
      sourceType: payload.sourceType as RetrievalMatch["sourceType"],
      service: (payload.service as string | null) ?? null,
      incidentCategory: (payload.incidentCategory as RetrievalMatch["incidentCategory"]) ?? null,
      severity: (payload.severity as RetrievalMatch["severity"]) ?? null,
      tags: (payload.tags as string[]) ?? [],
      createdAt: payload.createdAt as string,
      externalRef: payload.externalRef as string,
      title: payload.title as string,
      snippet: payload.snippet as string,
    };
  });
}
