# Local Setup Guide

## Prerequisites

- **Node.js ≥ 20** (`node -v`)
- **Docker Desktop**, running. Volt Tackle's infra (Postgres, Qdrant,
  Redpanda) runs in containers; the daemon must be up before `docker compose`.
- Ports free on the host: **4000** (API), **3000** (web), **15432** (Postgres),
  **6333/6334** (Qdrant), **9092/8080/8081/8082** (Redpanda + console).

> **Why Postgres on 15432 and not 5432?** To avoid clashing with any native
> PostgreSQL already installed on your machine. See
> [ADR 0008](adr/0008-local-infra-ports-and-redpanda.md).

---

## 1. Start infrastructure

```bash
docker compose up -d postgres qdrant
# (optional) add redpanda redpanda-console to exercise the Kafka path
```

Verify:

```bash
docker exec volt-tackle-postgres pg_isready -U volttackle -d volttackle
curl -s http://localhost:6333/collections
```

## 2. Install dependencies

```bash
npm install
```

This installs all workspaces and generates the Prisma client.

## 3. Configure environment

Copy each example file. Defaults work out of the box for a fully offline demo.

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp packages/database/.env.example packages/database/.env
```

Key variables (all in `apps/api/.env`):

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `…localhost:15432…` | Postgres connection |
| `QDRANT_URL` | `http://localhost:6333` | Vector store |
| `KAFKA_DISABLED` | `false` | Set `true` to process alerts inline, no broker |
| `LLM_PROVIDER` | `mock` | `openai` / `anthropic` / `mock` |
| `EMBEDDINGS_PROVIDER` | `mock` | `openai` / `mock` |
| `SAFETY_PROVIDER` | `mock` | `enkrypt` / `mock` |
| `MONITORING_PROVIDER` | `mock` | `datadog` / `prometheus` / `mock` |
| `DEPLOYMENT_PROVIDER` | `mock` | `github` / `mock` |
| `JWT_SECRET` | dev default | **change in production** |
| `OTEL_TRACES_CONSOLE` | `true` | print spans to stdout |

To use real services, set the provider + its API key, e.g.
`LLM_PROVIDER=openai` and `OPENAI_API_KEY=sk-…`. Any seam left as `mock`
keeps working offline.

> For the simplest demo, set `KAFKA_DISABLED=true` in `apps/api/.env` so you
> don't need the Redpanda container.

## 4. Migrate, seed, and index

```bash
npm run db:migrate        # applies packages/database/prisma/migrations
npm run db:seed           # 3 users, 5 runbooks, 4 service docs, 2 historical
                          # incidents + postmortems, prompt-version registry
npm run qdrant:bootstrap  # embeds runbooks/docs/incidents/postmortems into Qdrant
```

Seeded demo users (password `volttackle-demo`):

| Email | Role | Can approve high-risk? |
|-------|------|------------------------|
| `oncall.engineer@volttackle.dev` | ENGINEER | no |
| `senior.engineer@volttackle.dev` | SENIOR_ENGINEER | yes |
| `admin@volttackle.dev` | ADMIN | yes |

## 5. Run the apps

```bash
npm run dev:api    # http://localhost:4000  (Fastify)
npm run dev:web    # http://localhost:3000  (Next.js)
```

Then open **http://localhost:3000**.

---

## Health check

```bash
curl -s http://localhost:4000/health
# {"status":"ok","dbConnected":true,"llmProvider":"mock",...}
```

## Sending an alert manually

```bash
curl -X POST http://localhost:4000/api/webhooks/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "datadog",
    "externalId": "manual-001",
    "alertName": "5xx error rate spike",
    "service": "checkout-api",
    "severity": "SEV2",
    "message": "checkout-api 5xx error rate spiked shortly after the latest deploy",
    "tags": ["checkout-api","deploy"]
  }'
```

> Note the `/api` prefix — the PRD's shorthand `/webhooks/alerts` is served at
> `/api/webhooks/alerts` (see [ADR 0002](adr/0002-api-route-prefix.md)).

---

## Troubleshooting

**`docker compose` fails: "cannot connect to the Docker daemon"** — Docker
Desktop isn't running. Start it and wait for the whale icon to settle.

**`prisma migrate` fails: "Environment variable not found: DATABASE_URL"** —
you skipped `cp packages/database/.env.example packages/database/.env`. Prisma
CLI commands run from `packages/database`, so they read *that* directory's
`.env`.

**`P1000: Authentication failed`** — a *different* Postgres is answering on the
port. Confirm the container is the one bound to 15432
(`docker ps | grep postgres`) and that `DATABASE_URL` uses `15432`.

**Qdrant: "Client version X incompatible with server version Y"** — the pinned
image (`qdrant/qdrant:v1.18.2`) and client (`@qdrant/js-client-rest@1.18`)
should match. If you previously ran an older image, recreate the volume:
`docker compose down qdrant && docker volume rm volt-tackle_volt_tackle_qdrant_data && docker compose up -d qdrant`,
then re-run `npm run qdrant:bootstrap`.

**Port 15432 "access is denied"** — the host port falls inside a Windows
reserved range. Check `netsh interface ipv4 show excludedportrange protocol=tcp`
and pick a free port, updating `docker-compose.yml` and every `DATABASE_URL`.

**Typecheck everything** — `npm run typecheck` (runs across all 10 workspaces).
