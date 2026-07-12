# ADR 0001: Single monorepo with agents as in-process modules, not microservices

- Status: Accepted
- Date: 2026-07-07

## Context

The architecture diagram (`PRD/architecture-1783157533162.json`) draws each AI
agent (Triage, Retrieval, Root Cause, Remediation, Safety Validator,
Postmortem) and the Decision Gate as its own service node inside an "AI Agent
Fleet" group. Read literally, that suggests six-plus independently deployable
services plus an orchestrator.

The build brief, however, explicitly says: "Do not create unnecessary
microservices. Prefer one API app plus internal packages." These two inputs
are in tension.

## Decision

We implement a single npm-workspaces monorepo with one deployable application
(`apps/api`) plus the Next.js dashboard (`apps/web`). Every agent is a plain,
typed TypeScript function living in the `@volt-tackle/agents` package and runs
**in-process** inside the API application, sequenced by a single Mastra
workflow.

The diagram's service boundaries are preserved as **package/module
boundaries**, not as deployment boundaries:

- `packages/agents` — the six agents
- `packages/workflows` — the Mastra orchestration + decision gate
- `packages/retrieval` — Qdrant memory layer
- `packages/providers` — LLM / embeddings / monitoring / deployment adapters
- `packages/safety` — Enkrypt adapter
- `packages/observability`, `packages/shared`, `packages/database`

## Consequences

- Local setup is a single `npm run dev:api` process — no service mesh, no
  inter-service auth, no network hops between agents. This is appropriate for
  the "startup engineering team" target and the MVP scope.
- The clean package seams mean any agent or the retrieval layer can later be
  extracted into its own service with a transport shim, without rewriting call
  sites — they already depend only on typed function signatures.
- The PRD's non-functional "modular agent architecture to allow adding
  specialized agents" requirement is met at the package level.
