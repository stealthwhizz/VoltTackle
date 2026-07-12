import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { RepoContext, RepoContextRequest } from "@volt-tackle/shared";
import { emptyRepoContext, type RepoContextProvider } from "./types.js";
import { LocalGitRepoContextProvider } from "./localGitRepoContextProvider.js";

const exec = promisify(execFile);

function resolveGitAgentExportsPath(): string {
  const candidates = [process.cwd(), path.dirname(new URL(import.meta.url).pathname)];
  for (const base of candidates) {
    const modulePath = path.resolve(base, "node_modules", "@open-gitagent", "gitagent", "dist", "exports.js");
    if (existsSync(modulePath)) return modulePath;
  }

  let current = path.resolve(path.dirname(new URL(import.meta.url).pathname));
  while (true) {
    const modulePath = path.join(current, "node_modules", "@open-gitagent", "gitagent", "dist", "exports.js");
    if (existsSync(modulePath)) return modulePath;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error("Unable to locate @open-gitagent/gitagent/dist/exports.js in the workspace.");
}

async function loadGitAgentQuery() {
  const modulePath = resolveGitAgentExportsPath();
  return (await import(pathToFileURL(modulePath).href)) as { query: (args: unknown) => AsyncIterable<unknown> };
}

export interface GitAgentConfig {
  /** service -> repo URL. */
  repoMap: Record<string, string>;
  /** Optional logger for surfacing clone / runtime failures. */
  logger?: { warn: (entry: unknown, msg?: string) => void };
  /** GitHub PAT — required by gitagent's repo (clone) mode. */
  pat?: string;
  /** LLM key gitagent uses for its own agent loop. */
  llmApiKey?: string;
  /** provider:model gitagent should use, e.g. "openai:gpt-4o-mini". */
  model?: string;
  /**
   * Experimental: OpenAI-compatible base URL for gitagent's OpenAI provider
   * (e.g. Featherless). Undocumented upstream — see ADR 0009.
   */
  openaiBaseUrl?: string;
  maxTurns?: number;
  /** hard cap on the gitagent run before aborting → fallback (ms). */
  timeoutMs?: number;
  /** guaranteed fallback when gitagent can't run. */
  fallback: LocalGitRepoContextProvider;
}

interface GitAgentJsonResult {
  repo?: string;
  ref?: string;
  recentCommits?: RepoContext["recentCommits"];
  changedFiles?: string[];
  suspectSignals?: string[];
  summary?: string;
}

/**
 * Real GitAgent adapter using the `@open-gitagent/gitagent` **library** API
 * (`query()`), not the CLI. GitAgent clones the impacted repo into an
 * isolated sandbox dir and runs its own agent loop to summarize the changes
 * relevant to the incident; we consume the assistant output and parse a JSON
 * result.
 *
 * GitAgent's repo/clone mode requires a GitHub token and its own LLM. If a
 * token is missing, the LLM fails, or the run errors, this transparently
 * falls back to the plain local-git provider — so enabling it never breaks
 * the pipeline. GitAgent runs its OWN LLM loop; Volt Tackle's RCA/postmortem
 * still run on Featherless.
 */
export class GitAgentRepoContextProvider implements RepoContextProvider {
  readonly name = "gitagent" as const;

  constructor(private readonly config: GitAgentConfig) {}

  async getRepoContext(request: RepoContextRequest): Promise<RepoContext> {
    const repo = request.repoUrl ?? this.config.repoMap[request.service];
    if (!repo) {
      return emptyRepoContext("gitagent", `No repository provided for service "${request.service}".`);
    }
    if (!this.config.pat) {
      const fb = await this.config.fallback.getRepoContext(request);
      return { ...fb, summary: `[gitagent needs a GitHub token for clone mode → local-git fallback] ${fb.summary}` };
    }

    if (!this.config.model) {
      const fb = await this.config.fallback.getRepoContext(request);
      return { ...fb, summary: `[gitagent has no model configured (set Lyzr creds) → local-git fallback] ${fb.summary}` };
    }

    const model = this.config.model;
    let sandbox: string | null = null;
    const restoreEnv = this.applyLlmEnv();
    try {
      // Clone the repo ourselves into an isolated sandbox (we control auth and
      // depth), then seed a minimal agent.yaml the gitagent *library* needs
      // (unlike the CLI, query() does not auto-initialize an agent). One clone
      // is reused for every investigation question.
      sandbox = await mkdtemp(path.join(tmpdir(), "volt-gitagent-"));
      const cloneUrl = repo.replace("https://", `https://x-access-token:${this.config.pat}@`);
      await exec("git", ["clone", "--depth", "30", "--no-tags", cloneUrl, sandbox], { timeout: 90_000 });
      await writeFile(path.join(sandbox, "agent.yaml"), buildAgentManifest(model));

      // Multi-agent mode: answer each Featherless-generated question with a
      // GitAgent (Lyzr) archaeology run, reusing the single clone.
      if (request.questions && request.questions.length > 0) {
        const investigation: RepoContext["investigation"] = [];
        for (const question of request.questions) {
          const answer = await this.runGitAgent(sandbox, model, buildQuestionPrompt(request, question));
          investigation.push({ question, answer: answer.trim().slice(0, 1500) || "(no answer produced)" });
        }
        if (investigation.every((i) => i.answer.startsWith("(no answer"))) {
          const fb = await this.config.fallback.getRepoContext(request);
          return { ...fb, summary: `[gitagent produced no answers → local-git fallback] ${fb.summary}` };
        }
        return {
          available: true,
          provider: "gitagent",
          repo,
          ref: null,
          recentCommits: [],
          changedFiles: [],
          suspectSignals: [],
          investigation,
          summary: `GitAgent (Lyzr) answered ${investigation.length} investigation question(s) about ${repo}.`,
        };
      }

      // Single-analysis mode (no questions supplied).
      const finalText = await this.runGitAgent(sandbox, model, buildGitAgentPrompt(request));
      const result = parseGitAgentOutput(finalText, repo, request);
      if (!result.available) {
        const fb = await this.config.fallback.getRepoContext(request);
        return { ...fb, summary: `[gitagent produced no usable output → local-git fallback] ${fb.summary}` };
      }
      return result;
    } catch (err) {
      this.config.logger?.warn(
        { err, repo, service: request.service },
        "GitAgent repo context provider failed; falling back to local-git.",
      );
      const fb = await this.config.fallback.getRepoContext(request);
      return { ...fb, summary: `[gitagent run failed: ${(err as Error).message} → local-git fallback] ${fb.summary}` };
    } finally {
      restoreEnv();
      if (sandbox) await rm(sandbox, { recursive: true, force: true }).catch((cleanupErr) => {
        this.config.logger?.warn({ cleanupErr, sandbox }, "Failed to clean up GitAgent sandbox.");
      });
    }
  }

  /** Runs one GitAgent query against an already-cloned repo dir and returns the
   *  final assistant text. Throws on gitagent system errors or timeout. */
  private async runGitAgent(dir: string, model: string, prompt: string): Promise<string> {
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), this.config.timeoutMs ?? 150_000);
    let finalText = "";
    try {
      const { query: gitAgentQuery } = await loadGitAgentQuery();
      const q = gitAgentQuery({ prompt, dir, model, maxTurns: this.config.maxTurns ?? 12, abortController });
      for await (const msg of q) {
        if (msg.type === "assistant" && typeof msg.content === "string" && msg.content.trim()) {
          finalText = msg.content;
        }
        if (msg.type === "system" && (msg as { subtype?: string }).subtype === "error") {
          throw new Error(String((msg as { content?: string }).content ?? "gitagent system error"));
        }
      }
    } finally {
      clearTimeout(timer);
    }
    return finalText;
  }

  /**
   * Set the API-key env var gitagent's loader reads for this model, restoring
   * prior values afterward. gitagent resolves the key by provider prefix:
   * `openai:...` -> OPENAI_API_KEY, and any custom provider (e.g. `lyzr:...`,
   * `featherless:...`) -> <PROVIDER>_API_KEY (falling back to LYZR_API_KEY).
   * The base URL travels in the model string itself (`provider:model@baseUrl`),
   * or via GITAGENT_MODEL_BASE_URL when openaiBaseUrl is configured.
   */
  private applyLlmEnv(): () => void {
    const provider = (this.config.model?.split(":")[0] ?? "openai").toUpperCase();
    const keyVar = `${provider}_API_KEY`;
    const touched = [keyVar, "LYZR_API_KEY", "GITAGENT_MODEL_BASE_URL"];
    const prev = Object.fromEntries(touched.map((k) => [k, process.env[k]]));

    if (this.config.llmApiKey) {
      process.env[keyVar] = this.config.llmApiKey;
      // gitagent's unknown-provider path also accepts LYZR_API_KEY as a fallback.
      if (!process.env.LYZR_API_KEY) process.env.LYZR_API_KEY = this.config.llmApiKey;
    }
    if (this.config.openaiBaseUrl) process.env.GITAGENT_MODEL_BASE_URL = this.config.openaiBaseUrl;

    return () => {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    };
  }
}

function buildAgentManifest(model: string): string {
  // A `runtime.timeout` is REQUIRED — gitagent reads manifest.runtime.timeout
  // and throws "reading 'timeout'" if the section is absent (the CLI generates
  // it automatically; the library does not).
  return [
    "name: volt-repo-analyst",
    'version: "1.0.0"',
    "description: Read-only repository analyst for Volt Tackle incident postmortems.",
    "model:",
    `  preferred: "${model}"`,
    "runtime:",
    "  timeout: 300000",
  ].join("\n");
}

function buildQuestionPrompt(request: RepoContextRequest, question: string): string {
  return [
    `You are investigating the repository during a production incident on "${request.service}".`,
    `Incident context: ${request.incidentSummary}`,
    ``,
    `Answer this specific question by excavating the git history (commits, diffs, blame, timing, PRs).`,
    `Cite concrete commit SHAs and files. Be concise (3-5 sentences). Do not modify the repository.`,
    ``,
    `QUESTION: ${question}`,
  ].join("\n");
}

function buildGitAgentPrompt(request: RepoContextRequest): string {
  return [
    `You are analyzing a git repository during a production incident on service "${request.service}" (category: ${request.category}).`,
    `Incident: ${request.incidentSummary}`,
    ``,
    `Inspect the recent commit history and changed files. Then respond with ONLY a single JSON object (no prose, no code fences):`,
    `{"repo":string,"ref":string,"recentCommits":[{"sha":string,"author":string,"message":string,"date":string,"changedFiles":[string]}],"changedFiles":[string],"suspectSignals":[string],"summary":string}`,
    `"suspectSignals" = short notes on the commits/files most likely related to this incident. Do NOT modify the repository.`,
  ].join("\n");
}

function parseGitAgentOutput(text: string, repo: string, request: RepoContextRequest): RepoContext {
  const match = text.match(/\{[\s\S]*\}/);
  let parsed: GitAgentJsonResult | null = null;
  if (match) {
    try {
      parsed = JSON.parse(match[0]) as GitAgentJsonResult;
    } catch {
      parsed = null;
    }
  }

  // If the agent returned prose rather than strict JSON, keep its analysis as
  // the summary — it's still real, grounded repo context for the RCA.
  if (!parsed) {
    const prose = text.trim();
    if (!prose) return emptyRepoContext("gitagent", `gitagent returned no output for ${request.service}.`);
    return {
      available: true,
      provider: "gitagent",
      repo,
      ref: null,
      recentCommits: [],
      changedFiles: [],
      suspectSignals: [],
      investigation: [],
      summary: prose.slice(0, 2000),
    };
  }

  const recentCommits = (parsed.recentCommits ?? []).map((c) => ({
    sha: String(c.sha ?? "").slice(0, 7),
    author: c.author ?? "unknown",
    message: c.message ?? "",
    date: c.date ?? "",
    changedFiles: c.changedFiles ?? [],
  }));

  return {
    available: recentCommits.length > 0 || Boolean(parsed.summary),
    provider: "gitagent",
    repo: parsed.repo ?? repo,
    ref: parsed.ref ?? null,
    recentCommits,
    changedFiles: parsed.changedFiles ?? Array.from(new Set(recentCommits.flatMap((c) => c.changedFiles))),
    suspectSignals: parsed.suspectSignals ?? [],
    investigation: [],
    summary: parsed.summary ?? `GitAgent analyzed ${repo} for incident on ${request.service}.`,
  };
}
