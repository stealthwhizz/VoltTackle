# ADR 0007: Postgres is the transactional source of truth; Qdrant is semantic memory only

- Status: Accepted
- Date: 2026-07-07

## Context

The system has two datastores. The brief is explicit: "Postgres is the source
of truth for state. Qdrant is the semantic memory layer, not the transactional
source of truth." The PRD adds the reliability requirement that "workflow state
must be persisted in Postgres to allow recovery from service restarts."

## Decision

- All incident lifecycle state — incidents, events, recommendations,
  approvals, postmortems, audit logs, prompt versions, users, runbook/document
  source rows — lives in Postgres via Prisma (`packages/database`).
- Every workflow step writes its side effects (status transitions, events,
  recommendation rows, safety verdicts) to Postgres inside the step. The Mastra
  workflow **sequences** steps and threads cumulative state between them; it
  does not own durability.
- Qdrant holds only derived, embeddable copies of content for retrieval. It is
  rebuildable at any time from Postgres via `npm run qdrant:bootstrap`.

## Consequences

- Human-in-the-loop pauses are represented as a durable `AWAITING_APPROVAL`
  row, not an in-memory suspended run, so an API restart mid-incident loses no
  state (satisfies the PRD reliability requirement). See ADR 0003.
- Qdrant can be wiped and re-bootstrapped without data loss. (This actually
  happened during development when the Qdrant image was upgraded and its
  on-disk format changed — the volume was recreated and re-bootstrapped from
  Postgres with no loss of truth.)
- The one-directional dependency (Postgres → Qdrant, never the reverse) keeps
  the "learning loop" a pure enrichment: losing Qdrant degrades retrieval
  quality but never corrupts incident state.
