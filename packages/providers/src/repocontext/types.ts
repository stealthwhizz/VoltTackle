import type { RepoContext, RepoContextRequest } from "@volt-tackle/shared";

/**
 * Provider seam for pulling repository context into an incident. Mirrors the
 * other provider adapters (monitoring, deployment). Implementations: a real
 * GitAgent CLI adapter, a real lightweight local-git adapter, and an offline
 * deterministic mock. See docs/adr/0009-gitagent-repo-context.md.
 */
export interface RepoContextProvider {
  readonly name: RepoContext["provider"];
  getRepoContext(request: RepoContextRequest): Promise<RepoContext>;
}

/** Empty context returned when repo analysis is disabled or unavailable. */
export function emptyRepoContext(
  provider: RepoContext["provider"],
  summary = "Repository context was not analyzed for this incident.",
): RepoContext {
  return {
    available: false,
    provider,
    repo: null,
    ref: null,
    recentCommits: [],
    changedFiles: [],
    suspectSignals: [],
    investigation: [],
    summary,
  };
}

/**
 * Extracts lowercase keyword tokens from the incident summary used to flag
 * "suspect" commits/files whose text overlaps the incident. Shared by the
 * real adapters so their heuristics stay consistent.
 */
export function incidentKeywords(incidentSummary: string): string[] {
  const stop = new Set(["the", "and", "for", "with", "from", "into", "error", "rate", "after", "within"]);
  return Array.from(
    new Set(
      incidentSummary
        .toLowerCase()
        .match(/[a-z0-9_.-]{4,}/g)
        ?.filter((w) => !stop.has(w)) ?? [],
    ),
  ).slice(0, 12);
}
