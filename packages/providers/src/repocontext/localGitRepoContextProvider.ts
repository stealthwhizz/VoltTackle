import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import type { RepoContext, RepoContextRequest, RepoCommit } from "@volt-tackle/shared";
import { emptyRepoContext, incidentKeywords, type RepoContextProvider } from "./types.js";

const exec = promisify(execFile);

const FIELD_SEP = String.fromCharCode(0x1f); // unit separator between fields
const REC_SEP = String.fromCharCode(0x1e); // record separator, prefixed to each commit

export interface LocalGitConfig {
  /** service -> git remote URL or local path. Resolved per incident. */
  repoMap: Record<string, string>;
  /** optional PAT for private https clones (reuses GITHUB_TOKEN). */
  token?: string;
  maxCommits?: number;
}

/**
 * Real, lightweight repo-context adapter using plain `git` — no LLM, no
 * GitAgent runtime. It resolves the impacted service to a repo (a local path
 * or a remote it shallow-clones into an isolated temp dir), reads the recent
 * commits + changed files, flags the ones whose text overlaps the incident,
 * and always cleans up the sandbox. This is the path that works offline today
 * and proves the RepoContextProvider seam end to end.
 */
export class LocalGitRepoContextProvider implements RepoContextProvider {
  readonly name = "local-git" as const;

  constructor(private readonly config: LocalGitConfig) {}

  async getRepoContext(request: RepoContextRequest): Promise<RepoContext> {
    // A runtime URL (e.g. pasted in the UI) wins over the static service map.
    const target = request.repoUrl ?? this.config.repoMap[request.service];
    if (!target) {
      return emptyRepoContext("local-git", `No repository provided for service "${request.service}".`);
    }

    const isLocalPath = existsSync(target);
    let workdir = target;
    let sandbox: string | null = null;

    try {
      if (!isLocalPath) {
        sandbox = await mkdtemp(path.join(tmpdir(), "volt-repo-"));
        workdir = sandbox;
        const cloneUrl = this.config.token
          ? target.replace("https://", `https://x-access-token:${this.config.token}@`)
          : target;
        await exec("git", ["clone", "--depth", String(this.config.maxCommits ?? 20), "--no-tags", cloneUrl, workdir], {
          timeout: 60_000,
        });
      }

      const commits = await this.readCommits(workdir, this.config.maxCommits ?? 10);
      const ref = (await this.tryExec(workdir, ["rev-parse", "--abbrev-ref", "HEAD"]))?.trim() || null;
      const repoUrl = isLocalPath ? target : target.replace(/x-access-token:[^@]+@/, "");

      const keywords = incidentKeywords(request.incidentSummary);
      const changedFiles = Array.from(new Set(commits.flatMap((c) => c.changedFiles)));
      const suspectSignals = buildSuspectSignals(commits, keywords);

      return {
        available: commits.length > 0,
        provider: "local-git",
        repo: repoUrl,
        ref,
        recentCommits: commits,
        changedFiles,
        suspectSignals,
        investigation: [],
        summary: `Analyzed ${isLocalPath ? "local" : "cloned"} repo ${repoUrl} (${ref ?? "detached"}): ${commits.length} recent commits, ${changedFiles.length} changed files, ${suspectSignals.length} matching the incident signal.`,
      };
    } catch (err) {
      return emptyRepoContext("local-git", `Local git analysis failed for ${request.service}: ${(err as Error).message}`);
    } finally {
      if (sandbox) await rm(sandbox, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async readCommits(workdir: string, limit: number): Promise<RepoCommit[]> {
    // REC_SEP leads the format so each commit's --name-only file list stays
    // inside its own record instead of leaking into the next one.
    const format = REC_SEP + ["%H", "%an", "%s", "%aI"].join(FIELD_SEP);
    const out = await this.tryExec(workdir, ["log", `-n${limit}`, "--name-only", `--pretty=format:${format}`]);
    if (!out) return [];

    const commits: RepoCommit[] = [];
    for (const chunk of out.split(REC_SEP)) {
      const trimmed = chunk.replace(/^\n+|\n+$/g, "");
      if (!trimmed) continue;
      const [header, ...fileLines] = trimmed.split("\n");
      const [sha, author, message, date] = (header ?? "").split(FIELD_SEP);
      if (!sha) continue;
      commits.push({
        sha: sha.slice(0, 7),
        author: author ?? "unknown",
        message: message ?? "",
        date: date ?? "",
        changedFiles: fileLines.map((f) => f.trim()).filter(Boolean),
      });
    }
    return commits;
  }

  private async tryExec(cwd: string, args: string[]): Promise<string | null> {
    try {
      const { stdout } = await exec("git", ["-C", cwd, ...args], { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
      return stdout;
    } catch {
      return null;
    }
  }
}

function buildSuspectSignals(commits: RepoCommit[], keywords: string[]): string[] {
  const signals: string[] = [];
  for (const c of commits) {
    const haystack = `${c.message} ${c.changedFiles.join(" ")}`.toLowerCase();
    const hits = keywords.filter((k) => haystack.includes(k));
    if (hits.length > 0) {
      signals.push(`Commit ${c.sha} "${c.message}" overlaps incident terms: ${hits.slice(0, 4).join(", ")}.`);
    }
  }
  return signals.slice(0, 6);
}
