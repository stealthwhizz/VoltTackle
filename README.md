# ⚡ Volt Tackle

**An AI incident-response and post-mortem system for startup engineering teams.**

Volt Tackle turns a raw monitoring alert into a triaged incident, a
context-grounded root-cause hypothesis, and a safety-validated remediation —
then, after a human approves, an automatically drafted blameless postmortem
that feeds back into the system's semantic memory. Every AI suggestion clears a
mandatory safety gate **before** anyone sees an "Approve" button.

It also does **repository archaeology**: hand it a GitHub repo and a multi-agent
loop (Featherless asks investigative questions → GitAgent, running on Lyzr,
answers them from the git history) produces a repo-grounded postmortem.

```
 ALERT ─▶ incident ─▶ triage ─▶ retrieval ─▶ root cause ─▶ remediation ─▶ safety gate ─▶ decision
(webhook)  (Postgres)  (agent)   (Qdrant)      (agent)        (agent)       (Enkrypt)   approve /
                                     ▲                                                   escalate /
                          repo context (GitAgent + Lyzr)                                 block
                                                        human approves ─▶ postmortem ─▶ Qdrant (learning loop)
```

> Built to the attached PRD and architecture export as source of truth. Where
> the two conflicted, the resolution is documented in [`docs/adr/`](docs/adr/).

---

## The problem

When production breaks at a startup, the on-call engineer — often junior, often
alone at 2 AM — has to do a lot of high-pressure manual work: figure out *what*
broke, dig through logs/metrics/deploys, remember whether it's happened before,
and pick a fix **without making it worse**. Mistakes are easy ("cowboy" fixes,
hallucinated AI suggestions), knowledge is lost (postmortems get skipped), and
MTTR balloons. Startups don't have a mature SRE org to lean on.

## How Volt Tackle solves it

It's a **senior-engineer-in-a-box**: an AI copilot that does the investigation
grunt-work while the human keeps control of every real action.

- **Investigate automatically** — triage the alert, pull semantically similar
  past incidents/runbooks, and (for code issues) excavate the git history.
- **Ground every claim** — reasoning must cite real retrieved context or real
  commits; grounding is enforced in code, so the AI can't fabricate a source.
- **Never execute blindly** — 100% of remediations pass a deterministic safety
  gate; a human approves, escalates, or blocks; every decision is audited.
- **Get smarter over time** — each resolved incident's postmortem is indexed
  back into memory, so the next similar incident is faster.

---

## How the key technologies are used

### Featherless · GitAgent · Lyzr — the multi-agent brain

These three combine into a two-role investigation, best seen in the
**"postmortem a GitHub repo"** flow:

- **Featherless** (OpenAI-compatible LLM, `Qwen2.5-7B-Instruct`) is the
  **reasoning engine** for every Volt Tackle agent — triage, root cause,
  remediation, postmortem, and the *interrogator* that generates targeted
  investigation questions. Wired via a clean `LlmProvider` seam
  (`packages/providers/src/llm`), so swapping to OpenAI/Anthropic/mock is one
  env var.
- **GitAgent** (`@open-gitagent/gitagent`, used as a library) is the
  **archaeologist**: given a question, it clones the repo into an isolated
  sandbox and runs its own agent loop over the git history (commits, diffs,
  blame, timing) to answer it — citing real SHAs, refusing to invent evidence.
- **Lyzr** is the LLM that powers *GitAgent's* loop, wired through GitAgent's
  `lyzr:<agentId>@<baseUrl>` model syntax.

The multi-agent loop (`packages/workflows` → `packages/providers/src/repocontext`):

```
Featherless    →  "Which commit introduced the connection timeout, and why?"
GitAgent(Lyzr) →  "Commit f0d3cb7 tightened keepalive to 10s… (real archaeology)"
Featherless    →  root cause + postmortem, grounded in those findings
```

One clone is reused across all questions; each answer is stored on the incident
and fed into the RCA prompt. See [`docs/GITAGENT.md`](docs/GITAGENT.md) and
[ADR 0009](docs/adr/0009-gitagent-repo-context.md).

### Qdrant — semantic memory & retrieval

Qdrant is the long-term memory the "learning loop" writes to and reads from
(`packages/retrieval`).

- **One collection** `volt_tackle_memory` (cosine distance) holds all four
  content types — past incidents, runbooks, service docs, postmortems —
  distinguished by a keyword-indexed `sourceType` payload field (plus `service`,
  `incidentCategory`, `severity`, `tags`, `createdAt`, `externalRef`).
- **Retrieval** (the `retrieval` workflow step): the incident text is embedded
  and Qdrant is queried with `client.query(MEMORY_COLLECTION, { query: vector,
  filter, with_payload: true, limit })`; results are re-summarized by the
  Retrieval Summarizer agent, and only genuinely-retrieved refs survive into the
  grounded hypothesis.
- **Learning loop**: on postmortem finalization, the postmortem is embedded and
  `upsert`-ed back into the same collection — so it's retrievable for the next
  incident. (Verified live: the point count grows after each resolved incident.)

Postgres is the transactional source of truth; Qdrant is rebuildable from it at
any time via `npm run qdrant:bootstrap` ([ADR 0006](docs/adr/0006-single-qdrant-collection.md),
[0007](docs/adr/0007-postgres-source-of-truth.md)).

### Enkrypt AI — the safety gate

Enkrypt enforces the PRD's hard guarantee: **0% execution of unsafe commands**
(`packages/safety`).

- In the `safety-decision-gate` workflow step, the assembled remediation
  (summary + steps + rollback) is `POST`-ed to Enkrypt's guardrails API
  (`POST https://api.enkryptai.com/guardrails/detect`, `apikey` header) with
  detectors for `injection_attack`, `pii`, `toxicity`, `nsfw`, and a
  `keyword_detector` for destructive commands.
- The response `summary` is mapped to typed `SafetyFlag`s and a **deterministic
  verdict** — `SAFE` / `NEEDS_REVIEW` / `UNSAFE`. Crucially, an **LLM never
  decides** the verdict (it only phrases the rationale), so a hallucinating
  model can't approve its own dangerous fix.
- Verdict → decision gate: `UNSAFE` → `BLOCK_UNSAFE` (incident `BLOCKED`, the
  approve route hard-refuses with 403); `NEEDS_REVIEW` → `ESCALATE_TO_HUMAN`;
  `SAFE` → `APPROVE_FOR_REVIEW`. Verified: it blocks `rm -rf` / `drop table` and
  maps them to OWASP/NIST/EU-AI-Act frameworks.
  ([ADR 0005](docs/adr/0005-enkrypt-safety-integration.md))

### Mastra — orchestration

Mastra (`@mastra/core/workflows`) is the state machine that sequences the whole
pipeline (`packages/workflows/src/incidentWorkflow.ts`).

- The `incident-response` workflow is four `createStep`s chained with `.then()`
  and `.commit()`: **`triage` → `retrieval` → `analysis` →
  `safety-decision-gate`**. Each step's typed output feeds the next.
- It's executed with `workflow.createRun()` then `run.start({ inputData })`; the
  result's `status` drives fail-safe handling — any step throwing routes the
  incident to `ESCALATE_TO_HUMAN` rather than crashing or fabricating.
- Mastra **sequences and threads state**; it does **not** own persistence —
  every step writes its side effects (status transitions, events,
  recommendations, safety verdicts) to Postgres, so a restart never loses an
  in-flight incident.
  ([ADR 0003](docs/adr/0003-mastra-orchestration-agents-as-functions.md))

---

## Highlights

- **Full incident pipeline** — ingest → triage (4 categories) → semantic
  retrieval → root cause → remediation → safety gate → human decision →
  postmortem → learning loop. Orchestrated by a **Mastra** workflow with
  **Postgres** as the durable source of truth.
- **Mandatory safety gate** — 100% of remediations are scanned by **Enkrypt AI**
  (real, verified) for destructive commands, secret/PII leaks, and unsupported
  certainty. The verdict is computed deterministically — an LLM can never
  approve its own dangerous suggestion.
- **Grounded reasoning** — every hypothesis cites real retrieved context
  (Qdrant) or real git history (GitAgent); grounding is enforced in code, not
  just prompts.
- **Multi-agent repo investigation** — paste a GitHub URL and get a
  repo-grounded postmortem: **Featherless** generates targeted questions →
  **GitAgent** answers each from the git history → the findings drive
  the RCA and postmortem.
- **Provider/adapter everywhere** — LLM, embeddings, monitoring, deployment,
  safety, and repo-context each sit behind an interface with a real adapter and
  a working mock, so the whole system runs offline with zero keys and upgrades
  to real services one env var at a time.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, SWR |
| API | Fastify 5, TypeScript, Zod, JWT, rate limiting |
| Orchestration | Mastra (`@mastra/core/workflows`) |
| Agents | Typed TS functions, Zod-structured output, versioned prompt files |
| Reasoning LLM | **Featherless AI** (OpenAI-compatible) · OpenAI · Anthropic · offline mock |
| Repo archaeology | **GitAgent** (`@open-gitagent/gitagent`) on **Featherless** (or Anthropic/OpenAI) |
| Semantic memory | Qdrant (`@qdrant/js-client-rest`) |
| State (source of truth) | PostgreSQL + Prisma |
| Event streaming | Redpanda (Kafka-API compatible) via `kafkajs` |
| Safety | **Enkrypt AI** guardrails REST API + heuristic mock |
| Observability | OpenTelemetry traces + pino logs, incident correlation IDs |

---

## What's real vs mocked

The pipeline runs **fully offline with zero keys** (every seam has a
deterministic mock). Each external service upgrades independently by setting its
env var + key. In the current configured demo:

| Seam | Configured | Notes |
|------|-----------|-------|
| Reasoning LLM | **Featherless** (real) | `Qwen2.5-7B-Instruct`, OpenAI-compatible |
| Safety | **Enkrypt** (real) | verified: blocks `rm -rf`/`drop table`, maps to OWASP/NIST |
| Repo archaeology | **GitAgent + Lyzr** (real) | clones repo, runs agent loop per question |
| Embeddings | mock | deterministic feature-hashing; real retrieval offline |
| Monitoring / Deployment | mock | fabricated metrics/deploys; suppressed for repo analyses |

See [ADR 0004](docs/adr/0004-provider-adapters-mock-by-default.md) (mock-first)
and [ADR 0009](docs/adr/0009-gitagent-repo-context.md) (GitAgent layer).

---

## Monorepo layout

```
apps/
  api/          Fastify app — routes, auth, rate limit, Kafka, DI wiring
  web/          Next.js dashboard — incident list/detail, approval, repo-analysis, postmortem
packages/
  shared/       Zod schemas, enums, DTOs shared across apps
  database/     Prisma schema, client, migrations, seeds
  providers/    LLM · embeddings · monitoring · deployment · repo-context adapters (real + mock)
  safety/       Enkrypt adapter (real REST + heuristic mock)
  retrieval/    Qdrant client, collection, upsert, search, bootstrap
  agents/       7 agents + versioned prompt templates + prompt loader
  workflows/    Mastra incident workflow + postmortem generation
  observability/ OpenTelemetry tracing, pino logger, correlation IDs
docs/
  adr/          Architecture Decision Records (0001–0009)
  SETUP.md · GITAGENT.md · OBSERVABILITY.md · SECURITY.md
```

The architecture diagram's per-agent "service" nodes map to **packages**, not
deployables — see [ADR 0001](docs/adr/0001-monorepo-agents-as-modules.md).

**Agents:** Triage · Retrieval Summarizer · Root Cause · Remediation · Safety
Validator · Postmortem · Repo Investigator.

---

## Quick start

Requires **Node ≥ 20** and **Docker Desktop running**.

```bash
# 1. Infra (Postgres :15432, Qdrant :6333)
docker compose up -d postgres qdrant

# 2. Install
npm install

# 3. One-time env — copy the examples
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp packages/database/.env.example packages/database/.env

# 4. Database + semantic memory
npm run db:migrate
npm run db:seed
npm run qdrant:bootstrap

# 5. Run (two terminals)
npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:3000
```

Open **http://localhost:3000**, sign in with a seeded demo account (quick-fill
buttons; password `volttackle-demo`).

> **Postgres is on host port 15432** (not 5432) to avoid clashing with a local
> Postgres — see [ADR 0008](docs/adr/0008-local-infra-ports-and-redpanda.md).

### Try it

- **Incident flow** — click **+ Send test alert** → pick a scenario. Watch the
  incident move `TRIAGING → … → AWAITING_APPROVAL` (seconds), open it, review the
  recommendation + safety verdict, then **Approve** to generate a postmortem.
- **Repo postmortem** — use the **"Postmortem a GitHub repo"** panel, paste a
  repo URL, and **Analyze repository**. The multi-agent loop runs
  (Featherless → GitAgent/Lyzr → postmortem). ⏱ ~3 min — real git archaeology.

---

## Configuration

Everything is env-driven (`apps/api/.env`). Defaults are all `mock`. Key knobs:

| Variable | Options | Purpose |
|----------|---------|---------|
| `LLM_PROVIDER` | `featherless` · `openai` · `anthropic` · `mock` | reasoning LLM |
| `FEATHERLESS_API_KEY` / `FEATHERLESS_MODEL` | — | Featherless creds |
| `SAFETY_PROVIDER` | `enkrypt` · `mock` | safety gate |
| `ENKRYPT_API_KEY` | — | Enkrypt guardrails |
| `REPO_CONTEXT_PROVIDER` | `gitagent` · `local-git` · `mock` · `none` | repo layer |
| `LYZR_API_KEY` / `GITAGENT_LYZR_AGENT_ID` | — | GitAgent's LLM (Lyzr) |
| `GITHUB_TOKEN` | — | repo cloning (required by GitAgent) |
| `KAFKA_DISABLED` | `true` · `false` | inline vs Redpanda queue |

Repo-context setup and the Featherless/Lyzr findings are in
[`docs/GITAGENT.md`](docs/GITAGENT.md).

---

## The incident lifecycle

1. **Ingest** — `POST /api/webhooks/alerts` (or `POST /api/repo-analysis` for a
   repo). Idempotent on `source + externalId` to survive alert storms.
2. **Triage** — classify: `DEPLOY_REGRESSION` / `INFRA_FAILURE` /
   `DEPENDENCY_OUTAGE` / `SUSPICIOUS_TRAFFIC`.
3. **Retrieve** — semantic search over Qdrant (past incidents, runbooks, docs,
   postmortems). For repo analyses, GitAgent+Lyzr investigates the git history.
4. **Root cause** — hypothesis grounded in retrieved context / git findings.
5. **Remediate** — summary, numbered steps, risk label, rollback, confidence.
6. **Safety gate** — Enkrypt verdict → `approve_for_review` /
   `escalate_to_human` / `block_unsafe`.
7. **Human decision** — Approve / Escalate / Block on the dashboard (JWT +
   role-based; high-risk needs senior/admin; `UNSAFE` can't be approved).
   Logged to the audit trail.
8. **Postmortem + learning loop** — approval drafts a blameless postmortem and
   indexes it back into Qdrant for future retrieval.

### Key API routes

```
POST /api/webhooks/alerts          ingest an alert
POST /api/repo-analysis            postmortem a GitHub repo (multi-agent)
GET  /api/incidents                list
GET  /api/incidents/:id            detail (events, recommendation, postmortem)
POST /api/incidents/:id/approve    approve remediation (RBAC-gated)
POST /api/incidents/:id/escalate   escalate to human
POST /api/incidents/:id/block      block unsafe
GET  /api/incidents/:id/postmortem drafted postmortem
POST /api/auth/login               JWT login   ·   GET /api/auth/me
GET  /health                       liveness + active providers
```

---

## Scripts

```bash
npm run dev:api            # Fastify API (:4000)
npm run dev:web            # Next.js dashboard (:3000)
npm run typecheck          # typecheck all 10 workspaces
npm run db:migrate         # apply Prisma migrations
npm run db:seed            # users, runbooks, docs, historical incidents, prompts
npm run qdrant:bootstrap   # index runbooks/docs/incidents/postmortems into Qdrant
docker compose up -d       # start Postgres + Qdrant + Redpanda
```

Seeded demo users (password `volttackle-demo`): on-call engineer, senior
engineer (can approve high-risk), admin.

---

## Documentation

- [Setup guide](docs/SETUP.md) — prerequisites, env vars, troubleshooting
- [GitAgent layer](docs/GITAGENT.md) — repo-context providers, Lyzr/Featherless
- [Observability](docs/OBSERVABILITY.md) — traces, correlation IDs, what's logged
- [Security](docs/SECURITY.md) — auth/RBAC, audit trail, TLS/at-rest assumptions
- [ADRs](docs/adr/) — the nine major implementation decisions

---

## Status & honest limits

All 10 workspaces typecheck clean. The incident pipeline, safety gate, learning
loop, and multi-agent repo analysis are verified end-to-end against live
Postgres + Qdrant with real Featherless, Enkrypt, and GitAgent+Lyzr.

- **Repo analysis is slow** (~3 min): real GitAgent clone + agent loop per
  question, run sequentially. Test-alert incidents are fast (seconds).
- **Embeddings are mock** by default (real retrieval still works offline); set
  `OPENAI_API_KEY` + `EMBEDDINGS_PROVIDER=openai` for real embeddings.
- The repo **investigation Q&A** surfaces in the incident **timeline** events;
  a dedicated postmortem-panel view is not built yet.
