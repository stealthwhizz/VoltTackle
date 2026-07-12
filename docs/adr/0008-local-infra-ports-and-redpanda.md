# ADR 0008: Local infra — Redpanda for Kafka, Postgres on host port 15432

- Status: Accepted
- Date: 2026-07-07

## Context

The stack lists "Kafka / Redpanda" for event streaming and PostgreSQL for
state. The brief asks for a Docker Compose that is "simple and runnable
locally." Two practical issues surfaced while bringing the stack up on the
development machine.

## Decision

**Message broker: single-node Redpanda.** We use `redpandadata/redpanda` (Kafka
-API compatible, no Zookeeper) plus the Redpanda Console UI. The application
talks to it with `kafkajs`, so the exact same client code runs against a real
Kafka cluster in production by only changing `KAFKA_BROKERS`.

**Postgres host port 15432, not 5432.** The dev machine already ran a native
PostgreSQL 17 Windows service bound to 5432. Rather than fight it, the Compose
file maps the container to host port **15432**. Port 15432 was also chosen to
sit outside Windows' reserved/excluded dynamic TCP port ranges (an initial
attempt at 55432 failed because it fell inside an excluded range — check with
`netsh interface ipv4 show excludedportrange protocol=tcp`). `DATABASE_URL` in
all `.env.example` files uses 15432.

**Kafka toggle for demos.** `apps/api` supports `KAFKA_DISABLED=true`, which
bypasses the broker entirely and processes webhook alerts inline in the request
handler. This lets the full pipeline be demoed with only Postgres + Qdrant
running (no broker), which is the recommended quick-start path.

## Consequences

- The recommended local demo runs Postgres + Qdrant + `KAFKA_DISABLED=true`.
  The Kafka/Redpanda path is exercised by flipping `KAFKA_DISABLED=false` and
  starting the `redpanda` service.
- Qdrant is pinned to `v1.18.2` to match the `@qdrant/js-client-rest@1.18`
  client (a mismatched older server triggers a compatibility warning and, on a
  major-version storage change, an incompatible on-disk format).
- Anyone without a conflicting local Postgres can still use 15432 with no
  change; the non-standard port is harmless.
