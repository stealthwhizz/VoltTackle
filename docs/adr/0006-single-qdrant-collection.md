# ADR 0006: One Qdrant collection for all memory, filtered by `sourceType` payload

- Status: Accepted
- Date: 2026-07-07

## Context

The PRD requires semantic memory over four content types: past incident
reports, technical runbooks, service documentation, and finalized postmortems.
This could be modeled as four separate Qdrant collections or one collection
with a discriminator field.

## Decision

A single collection, `volt_tackle_memory`, holds all four content types. Every
point carries a `RetrievalPayload` with the metadata the brief requires:
`sourceType`, `service`, `incidentCategory`, `severity`, `tags`, `createdAt`,
`externalRef`, plus `title`/`snippet` for display. `sourceType` is a keyword
-indexed payload field; queries that want only runbooks (or docs, etc.) pass a
Qdrant `must` filter on it.

Distance metric is Cosine; vectors are provided by the active
`EmbeddingsProvider` (1536-dim OpenAI, or 384-dim mock).

## Rationale

- Qdrant payload filtering on an indexed keyword field is as cheap as querying
  a dedicated collection, so four collections would add operational overhead
  (four create/index/health paths) for no query-performance gain at MVP scale.
- The common "find anything similar to this incident, across incidents,
  runbooks, and docs" query — which the Retrieval Agent actually issues — is a
  single search over one collection instead of a fan-out-and-merge over four.

## Consequences

- The learning loop is a single upsert: a finalized postmortem is embedded and
  written to the same collection with `sourceType: "POSTMORTEM"`, immediately
  retrievable for future incidents. (Verified live: collection grew 13 → 14
  points after an approve→postmortem cycle.)
- If one content type later needs a different vector dimension or distance
  metric, it would justify splitting into its own collection; not needed now.
