import type { QdrantClient } from "@qdrant/js-client-rest";
import type { EmbeddingsProvider } from "@volt-tackle/providers";
import type { RetrievalMatch } from "@volt-tackle/shared";
import { searchMemory } from "./search.js";

export interface RetrieveIncidentContextInput {
  incidentSummary: string;
  service: string;
  limit?: number;
}

/**
 * Used by the Retrieval Agent: searches across all memory types (past
 * incidents, runbooks, service docs, postmortems) for whatever is most
 * semantically similar to the current incident. Deliberately does not hard
 * -filter by service — a runbook from another service can still be the
 * right grounding (e.g. a shared "credential stuffing" runbook).
 */
export async function retrieveIncidentContext(
  client: QdrantClient,
  embeddingsProvider: EmbeddingsProvider,
  input: RetrieveIncidentContextInput,
): Promise<RetrievalMatch[]> {
  return searchMemory(client, embeddingsProvider, {
    queryText: `${input.service}: ${input.incidentSummary}`,
    limit: input.limit ?? 6,
  });
}
