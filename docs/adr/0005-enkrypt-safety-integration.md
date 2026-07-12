# ADR 0005: Enkrypt safety via REST adapter + heuristic mock; verdict is deterministic

- Status: Accepted
- Date: 2026-07-07

## Context

The PRD requires that "100% of remediation suggestions must pass through
Enkrypt AI before being presented to a user or executed," to detect
hallucinations, destructive commands, and PII/secret leaks. There is no
confirmed, official Enkrypt npm SDK for Node/TypeScript. Enkrypt does document
a REST Guardrails API (`POST https://api.enkryptai.com/guardrails/detect`,
`apikey` header, detectors for pii/toxicity/injection_attack/policy_violation/
keyword_detector, returning a `summary` of per-detector hits).

## Decision

The safety layer is a `SafetyAdapter` interface (`packages/safety`) with:

- `RealEnkryptAdapter` — calls the documented REST endpoint via `fetch`, maps
  the response `summary` into typed `SafetyFlag`s, and derives a verdict.
- `MockEnkryptAdapter` (default) — performs equivalent heuristic detection
  locally: destructive-command regex bank (`rm -rf`, `drop table`, disabling
  auth/firewall, force-push to main, etc.), token/PII pattern scan, and
  CRITICAL-risk gating.

Crucially, the **verdict** (`SAFE` / `NEEDS_REVIEW` / `UNSAFE`) is computed
deterministically by the adapter, not by an LLM. The Safety Validator *agent*
only asks the LLM to phrase a human-readable rationale for the
already-decided verdict, and falls back to the adapter's own rationale if that
phrasing call fails. A flaky or adversarial model can therefore never flip a
safety decision.

The verdict maps to the decision gate:

- `UNSAFE` → `BLOCK_UNSAFE` → incident status `BLOCKED` (approval route hard
  -refuses with HTTP 403)
- `NEEDS_REVIEW` → `ESCALATE_TO_HUMAN` → `AWAITING_APPROVAL`
- `SAFE` → `APPROVE_FOR_REVIEW` → `AWAITING_APPROVAL`

## Consequences

- The PRD's "0% execution of blocked/unsafe commands" is enforced at two
  layers: the workflow sets `BLOCKED` status, and the approve route
  independently rejects any recommendation whose `safetyVerdict === "UNSAFE"`.
- If Enkrypt ships an official SDK later, only `RealEnkryptAdapter` changes.
- Switching to real Enkrypt: `SAFETY_PROVIDER=enkrypt` + `ENKRYPT_API_KEY`.
