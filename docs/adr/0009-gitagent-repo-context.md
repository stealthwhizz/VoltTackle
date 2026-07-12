# ADR 0009: Optional GitAgent repo-context layer behind a provider seam

- Status: Accepted
- Date: 2026-07-12

## Context

When an incident is a deploy regression, the single most useful missing signal
is *what actually changed in the code*. We evaluated adding
[GitAgent](https://github.com/open-gitagent/gitagent)
(`@open-gitagent/gitagent`, TypeScript, Node ≥20, MIT) as a sandboxed
repository-context layer: clone the impacted repo, inspect recent
commits/changed files, and feed that into the RCA flow.

GitAgent is a strong technical match (TS, library `query()` + CLI, native repo
cloning with session branches, optional sandbox VM). But it is a full
**agentic framework** — it runs its own LLM loop, executes commands, and
commits memory back into git — not a lightweight "clone-and-read" utility.
Dropping its whole runtime into the incident hot path would be heavy and would
introduce a second, independent LLM inside GitAgent.

Separately: Volt Tackle's reasoning runs on **Featherless** (OpenAI-compatible).
GitAgent selects models via `provider:model` over openai/anthropic/google/groq/
mistral; a **custom OpenAI base URL is undocumented**, so Featherless cannot be
cleanly wired *inside* GitAgent today.

## Decision

Introduce a narrow `RepoContextProvider` seam in `packages/providers`
(mirroring the existing `MonitoringProvider` / `DeploymentProvider` adapters),
with three implementations selected by `REPO_CONTEXT_PROVIDER`:

- **`gitagent`** — the real path. Shells out to the `gitagent` CLI to clone and
  summarize the repo, parsing a JSON result. If the CLI is absent or errors, it
  transparently **falls back to `local-git`**, so enabling it can never break
  the pipeline.
- **`local-git`** — a real, lightweight, LLM-free path using plain `git`:
  shallow-clones the mapped repo into an isolated temp sandbox (always cleaned
  up), extracts recent commits + changed files, flags the ones whose text
  overlaps the incident signal. Works offline today; this is the vertical slice
  that proves the seam.
- **`mock`** — deterministic offline context for demos with no git/network.
- **`none`** (default) — a no-op returning unavailable context; the RCA behaves
  exactly as before.

Repo context is fetched only for deploy-related categories
(`DEPLOY_REGRESSION`) and merged into `RootCauseInput.repoContext` as **grounded
data**, consistent with the RCA v1 prompt's existing instruction to correlate
deploy metadata. No prompt-version churn.

**Boundary chosen for Featherless:** GitAgent (or git) supplies repository
*facts*; Featherless supplies the RCA *reasoning* that consumes them. Featherless
therefore remains the reasoning engine and is now enriched with repo context —
which is the more valuable and more testable integration than forcing Featherless
inside GitAgent. An experimental `GITAGENT_OPENAI_BASE_URL` env passthrough is
wired for a future base-URL-aware GitAgent, documented as **unverified**.

## Consequences

- **Additive and default-off.** With `REPO_CONTEXT_PROVIDER=none` the pipeline is
  byte-for-byte the previous behavior. Existing tests/flows unaffected.
- The RCA can now cite specific commit SHAs as the culprit when repo context is
  available.
- A new `REPO_CONTEXT_FETCHED` incident event records what was analyzed, visible
  in the timeline.
- The GitAgent runtime is heavy (its own LLM + PAT + clone). We keep it opt-in;
  `local-git` is the recommended real path for now and needs no LLM.
- If GitAgent later documents a base-URL override, Featherless can drive
  GitAgent's own loop by setting `GITAGENT_OPENAI_BASE_URL` — no code change.
