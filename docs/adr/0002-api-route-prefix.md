# ADR 0002: All HTTP routes under the `/api` prefix

- Status: Accepted
- Date: 2026-07-07

## Context

The PRD (section 10) specifies routes without a prefix, e.g.
`POST /webhooks/alerts`, `GET /incidents`, `POST /incidents/:id/approve`. The
build brief specifies the same routes **with** an `/api` prefix, e.g.
`POST /api/webhooks/alerts`, `GET /api/incidents`.

## Decision

All routes are served under `/api`. The build brief's explicit instruction
wins over the PRD's shorthand, and a consistent prefix keeps the API surface
cleanly separable from any future static/asset routes and simplifies reverse
-proxy configuration.

Final route list:

- `POST /api/webhooks/alerts`
- `GET  /api/incidents`
- `GET  /api/incidents/:id`
- `GET  /api/incidents/:id/postmortem`
- `POST /api/incidents/:id/approve`
- `POST /api/incidents/:id/escalate`
- `POST /api/incidents/:id/block`
- `POST /api/auth/login`, `GET /api/auth/me`
- `GET  /health` (unprefixed — conventional for infra probes)

## Consequences

- Any external monitoring tool configured against the PRD's bare
  `/webhooks/alerts` path must be pointed at `/api/webhooks/alerts`. Documented
  in `docs/SETUP.md`.
