# ADR 0004: Provider/adapter pattern with mock implementations active by default

- Status: Accepted
- Date: 2026-07-07

## Context

Volt Tackle integrates several external systems: LLMs (OpenAI/Anthropic),
embeddings, monitoring (Datadog/Prometheus), deployment metadata
(GitHub/GitLab), and the Enkrypt safety platform. No credentials for any of
these are available in the build/demo environment, yet the brief requires the
MVP to "work end-to-end" locally and to "implement mock adapters with
realistic behavior" when credentials are missing.

## Decision

Every external system sits behind a small TypeScript interface with at least
two implementations — a real adapter and a mock — chosen by a factory that
reads env vars and falls back to the mock when the relevant key is absent:

| Seam | Interface | Real | Mock |
|------|-----------|------|------|
| LLM | `LlmProvider` | OpenAI, Anthropic | `MockLlmProvider` (schema-driven faker) |
| Embeddings | `EmbeddingsProvider` | OpenAI `text-embedding-3-small` | `MockEmbeddingsProvider` (feature-hashing) |
| Monitoring | `MonitoringProvider` | Datadog, Prometheus | `MockMonitoringProvider` |
| Deployment | `DeploymentProvider` | GitHub | `MockDeploymentProvider` |
| Safety | `SafetyAdapter` | Enkrypt REST | `MockEnkryptAdapter` (heuristic) |

The mocks are **deterministic and behaviorally meaningful**, not empty stubs:

- `MockEmbeddingsProvider` uses the hashing trick (feature hashing over
  tokens) so texts sharing vocabulary land close in cosine space — real
  semantic retrieval works offline. (Verified: a deploy-regression query
  scores 0.48 against a deploy runbook vs 0.09 against a suspicious-traffic
  doc.)
- `MockLlmProvider` generates schema-valid output from any Zod schema, picking
  enum values by keyword overlap against the incident-specific prompt, so
  triage classification and risk labels actually vary by input.
- `MockEnkryptAdapter` runs real destructive-command / secret pattern matching
  and CRITICAL-risk gating, so the safety verdict is genuinely computed.

## Consequences

- `npm run dev:api` with an empty `.env` produces a fully working pipeline.
- Going to production is per-seam and incremental: set `LLM_PROVIDER=openai` +
  `OPENAI_API_KEY`, or `SAFETY_PROVIDER=enkrypt` + `ENKRYPT_API_KEY`, etc. No
  code changes.
- Mock output is clearly labeled ("Mock-generated…") so it is never mistaken
  for a real model response in the UI or logs.
