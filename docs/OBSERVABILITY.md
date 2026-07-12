# Observability

Volt Tackle ships an OpenTelemetry tracing scaffold plus structured logging,
all correlated to a per-incident ID so a single incident's journey through
triage → retrieval → analysis → safety is queryable as one trace.

Implementation lives in `packages/observability`.

## Tracing

`initTracing()` (called once in `apps/api/src/server.ts`) starts a
`NodeSDK` with auto-instrumentation. Spans export to an OTLP endpoint if
`OTEL_EXPORTER_OTLP_ENDPOINT` is set, otherwise to the console
(`OTEL_TRACES_CONSOLE=true`) so you can watch traces during local development.

Span helpers wrap each unit of work:

- `withWorkflowSpan(...)` — one span per workflow run (`workflow.incident-response`).
- `withAgentSpan(...)` — one span per agent step (`agent.triage-agent`,
  `agent.root-cause-agent`, …), automatically recording exceptions and setting
  `ERROR` status on failure.

### Standard span attributes

Every span carries these attributes (namespaced `volttackle.*`) so traces are
filterable by incident, agent, model, and outcome:

| Attribute | Meaning |
|-----------|---------|
| `volttackle.incident_id` | Incident correlation across all steps |
| `volttackle.correlation_id` | Workflow run / request correlation ID |
| `volttackle.agent_name` | Which agent produced the span |
| `volttackle.prompt_version` | Versioned prompt used (e.g. `triage-agent@v1`) |
| `volttackle.llm_provider` / `volttackle.llm_model` | Which model answered |
| `volttackle.tokens.prompt` / `volttackle.tokens.completion` | Token usage (placeholders wired for real providers; `-1` when unknown, e.g. mock) |
| `volttackle.retrieval.latency_ms` | Qdrant search latency |
| `volttackle.retrieval.match_count` | Number of memory items retrieved |
| `volttackle.safety.verdict` | `SAFE` / `NEEDS_REVIEW` / `UNSAFE` |
| `volttackle.decision.outcome` | `APPROVE_FOR_REVIEW` / `ESCALATE_TO_HUMAN` / `BLOCK_UNSAFE` |
| `volttackle.workflow_name` | Workflow identifier |

These cover every signal the brief asked for: workflow start/end, each agent
step, retrieval latency, model used, prompt version, token-usage placeholders,
incident correlation ID, and the safety verdict.

## Logging

`createLogger()` returns a `pino` logger (pretty-printed in development). Each
pipeline stage logs a structured line including `incidentId`, the agent name,
and the salient result (classification + confidence, match count + latency,
risk label, safety verdict). Example:

```
INFO  Triage complete   incidentId=… agent=triage-agent category=DEPLOY_REGRESSION confidence=0.76
INFO  Postmortem generated and indexed into Qdrant   incidentId=… postmortemId=…
```

## Correlation IDs

Each incident has a `correlationId` (UUID) generated at ingestion and persisted
on the `Incident` row. It is threaded through the workflow and stamped on every
span and audit log, so one identifier ties together: the Postgres incident,
its events, its trace, and its logs. `packages/observability/correlation.ts`
also provides an `AsyncLocalStorage`-based context for ambient propagation.

## Connecting a real backend

Point traces at any OTLP-compatible collector (Grafana Tempo, Honeycomb, Jaeger
via the OTLP receiver, etc.):

```bash
# apps/api/.env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_TRACES_CONSOLE=false
```

The PRD's mention of Prometheus/Grafana for the Observability Agent is a
natural extension: the span attributes above (latency, token usage, verdict
counts) are already the metrics you'd derive dashboards and SLOs from.
