# Security & Operations

This documents the security controls implemented in the MVP and the
deployment-time assumptions the PRD calls for (TLS 1.3 in transit, AES-256 at
rest) that live outside application code.

## Authentication

- JWT-based. `POST /api/auth/login` verifies an email/password against the
  `User` table (passwords hashed with bcrypt) and returns a signed token
  (`@fastify/jwt`, secret `JWT_SECRET`, expiry `JWT_EXPIRES_IN`).
- Protected routes use the `authenticate` preHandler, which verifies the bearer
  token and rejects with `401` otherwise.
- `GET /api/auth/me` returns the current token's claims.

> `JWT_SECRET` ships with a dev-only default and **must** be overridden in any
> non-local environment.

## Authorization (RBAC)

Roles: `ENGINEER`, `SENIOR_ENGINEER`, `ADMIN`.

- Reading incidents is open to any authenticated user.
- The **approve** action on a **HIGH or CRITICAL** risk remediation requires
  `SENIOR_ENGINEER` or `ADMIN` (PRD: "Role-based access for Approve actions,
  e.g. Senior Engineers only for high-risk fixes"). Enforced server-side in the
  approve route and mirrored in the UI (disabled button + explanation).
- A remediation whose safety verdict is `UNSAFE` cannot be approved by anyone —
  the route returns `403` regardless of role.
- `fastify.requireRole(...)` is available as a reusable guard for future routes.

## Rate limiting

`@fastify/rate-limit` with a global default (300 req/min) plus tighter
per-route limits on the sensitive endpoints:

- `POST /api/webhooks/alerts` — 120/min (absorbs alert bursts without letting a
  misconfigured source hammer the API).
- `POST /api/incidents/:id/{approve,escalate,block}` — 30/min each.

## Audit trail

Every human decision writes an `AuditLog` row (`actorId`, `actorLabel`,
`action`, `entityType`, `entityId`, `metadata`, `createdAt`). Actions recorded
include `INCIDENT_APPROVED`, `INCIDENT_ESCALATED`, `INCIDENT_BLOCKED`, plus
system actions `INCIDENT_AUTO_BLOCKED` (safety gate) and
`INCIDENT_AUTO_ESCALATED_ON_FAILURE` (workflow fail-safe). This satisfies the
PRD's "every action taken by an agent or human must be logged in Postgres."

## Safety of AI output

100% of remediations pass the Enkrypt safety gate before being exposed, and the
verdict is computed deterministically (not by an LLM). See
[ADR 0005](adr/0005-enkrypt-safety-integration.md). Guardrails cover
destructive commands, secret/PII leakage, and unsupported certainty
(CRITICAL-risk remediations are escalated to a human even absent an explicit
flag).

## Data protection assumptions (deployment-time)

The following are infrastructure responsibilities, not application code, and
are assumed to be provided by the deployment environment per the PRD:

- **TLS 1.3 in transit.** Terminate TLS at the load balancer / ingress in front
  of both `apps/api` and `apps/web`, and require TLS for connections to
  Postgres, Qdrant, and the Kafka/Redpanda brokers (`sslmode=require` on
  `DATABASE_URL`, TLS listeners on the broker). No plaintext service should be
  exposed outside the cluster. Locally we run plaintext for developer
  ergonomics only.
- **AES-256 at rest.** Enable encryption at rest on the Postgres volume
  (e.g. cloud-managed encrypted EBS/RDS), the Qdrant storage volume, and any
  Kafka/Redpanda log directories. Secrets (`JWT_SECRET`, provider API keys)
  belong in a secrets manager, not in committed `.env` files.
- **PII/secret leak scanning.** The Enkrypt safety layer additionally scans
  agent output for PII and secrets before it reaches a user (PRD 11).

## Secrets handling

- `.env*` files are git-ignored; only `.env.example` templates are committed.
- API keys are read at process start and never logged. Provider selection logs
  only the provider *name* (`llmProvider: "mock"`), never the key.
