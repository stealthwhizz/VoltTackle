import { QdrantClient } from "@qdrant/js-client-rest";

export const MEMORY_COLLECTION = "volt_tackle_memory";

export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

/**
 * Single collection for all semantic memory (incidents, runbooks, service
 * docs, postmortems), distinguished by the `sourceType` payload field and
 * filtered on at query time. Simpler to operate than four collections for
 * an MVP, and Qdrant filters make the "search only runbooks" case just as
 * cheap as a dedicated collection would be.
 */
export function createQdrantClient(config: QdrantConfig): QdrantClient {
  return new QdrantClient({ url: config.url, apiKey: config.apiKey });
}
