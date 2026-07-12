import type { RepoContext, RepoContextRequest } from "@volt-tackle/shared";
import type { RepoContextProvider } from "./types.js";

/**
 * Deterministic offline repo-context adapter. Produces plausible recent
 * commits and changed files for the impacted service without cloning
 * anything, so the RCA-with-repo-context flow can be demoed with no git,
 * no network, and no GitHub token.
 */
export class MockRepoContextProvider implements RepoContextProvider {
  readonly name = "mock" as const;

  async getRepoContext(request: RepoContextRequest): Promise<RepoContext> {
    const seed = hash(request.service);
    const authors = ["alex.chen", "priya.nair", "jordan.lee", "marcus.idowu"];
    const now = Date.now();

    const commits = [
      {
        sha: hash(`${request.service}-1`).toString(16).slice(0, 7),
        author: authors[seed % authors.length] as string,
        message: `feat(${request.service}): add expand/contract migration for orders table`,
        date: new Date(now - 22 * 60_000).toISOString(),
        changedFiles: [`services/${request.service}/migrations/0042_drop_legacy_col.sql`, `services/${request.service}/src/db/schema.ts`],
      },
      {
        sha: hash(`${request.service}-2`).toString(16).slice(0, 7),
        author: authors[(seed + 1) % authors.length] as string,
        message: `chore(${request.service}): bump connection pool size`,
        date: new Date(now - 74 * 60_000).toISOString(),
        changedFiles: [`services/${request.service}/config/database.yaml`],
      },
    ];

    const changedFiles = Array.from(new Set(commits.flatMap((c) => c.changedFiles)));
    const suspectSignals = [
      `Recent migration touches the orders schema (${commits[0]?.changedFiles[0]}) minutes before the incident.`,
    ];

    return {
      available: true,
      provider: "mock",
      repo: `https://github.com/acme/${request.service}`,
      ref: "main",
      recentCommits: commits,
      changedFiles,
      suspectSignals,
      investigation: [],
      summary: `Mock repo context for ${request.service}: ${commits.length} recent commits, ${changedFiles.length} changed files; a schema migration lands just before the incident window.`,
    };
  }
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
