# Architecture Decision Records

Each ADR documents a significant implementation decision — especially where the
PRD and the architecture diagram were in tension and a practical,
TypeScript-first resolution was chosen.

| # | Decision |
|---|----------|
| [0001](0001-monorepo-agents-as-modules.md) | Single monorepo; agents are in-process modules, not microservices |
| [0002](0002-api-route-prefix.md) | All HTTP routes under the `/api` prefix |
| [0003](0003-mastra-orchestration-agents-as-functions.md) | Mastra for orchestration only; agents as typed functions over a provider seam |
| [0004](0004-provider-adapters-mock-by-default.md) | Provider/adapter pattern with mock implementations active by default |
| [0005](0005-enkrypt-safety-integration.md) | Enkrypt via REST adapter + heuristic mock; verdict is deterministic |
| [0006](0006-single-qdrant-collection.md) | One Qdrant collection for all memory, filtered by `sourceType` |
| [0007](0007-postgres-source-of-truth.md) | Postgres is transactional truth; Qdrant is semantic memory only |
| [0008](0008-local-infra-ports-and-redpanda.md) | Local infra: Redpanda for Kafka, Postgres on host port 15432 |
| [0009](0009-gitagent-repo-context.md) | Optional GitAgent repo-context layer behind a provider seam |
