# ADR 0003: Mastra for orchestration only; agents as typed functions over a provider seam

- Status: Accepted
- Date: 2026-07-07

## Context

The stack mandates Mastra (TypeScript) as the orchestration layer. Mastra
offers two surfaces we could lean on: its **workflow** engine
(`createStep`/`createWorkflow().then().commit()` with suspend/resume) and its
**Agent** class (model binding, tool calling, memory). We must also produce
structured, Zod-validated outputs from every agent and support both OpenAI and
Anthropic behind clean abstractions — and run fully offline with no API keys.

## Decision

We use Mastra's **workflow engine** (`@mastra/core/workflows`) as the real
orchestrator for the incident pipeline: triage → retrieval → analysis (RCA +
remediation) → safety/decision-gate, chained with `.then()` and executed via
`workflow.createRun().start()`.

We do **not** use Mastra's `Agent` class. Each agent is a plain async function
in `@volt-tackle/agents` that:

1. loads a versioned prompt template file,
2. calls an `LlmProvider.generateStructured({ schema, system, prompt })` seam,
3. validates the result against a Zod schema, and
4. fails safe by throwing `AgentExecutionError` (which the workflow catches and
   routes to `ESCALATE_TO_HUMAN`).

The `LlmProvider` seam has three implementations: `OpenAiLlmProvider`,
`AnthropicLlmProvider`, and a deterministic `MockLlmProvider` (a schema-driven
faker) selected automatically when no API key is present.

## Rationale

- The workflow engine is the part of Mastra that most directly satisfies the
  PRD's "Mastra-managed state machine handling HITL branching and agent
  dispatching" — so we use the real thing there.
- Hand-rolling agents over a narrow provider interface gives us: guaranteed
  Zod-validated structured output, trivial provider swapping (OpenAI ↔
  Anthropic ↔ mock), and a fully offline demo path. Binding agents to Mastra's
  `Agent` class would couple prompt/version/grounding logic to a surface that
  is harder to unit test without live model access.
- Grounding ("all reasoning grounded in retrieved context") is enforced in
  **code**, not just prompts: RCA/remediation outputs are filtered so only
  references that were actually retrieved survive into persistence.

## Consequences

- Human-in-the-loop is modeled as workflow **completion** into an
  `AWAITING_APPROVAL` state persisted in Postgres, with the human decision
  arriving via a separate authenticated HTTP route — rather than a long-lived
  suspended Mastra run. This is more robust across API restarts (the PRD's
  reliability requirement) since state lives in Postgres, not process memory.
- Swapping to real models is a single env change (`LLM_PROVIDER`,
  `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`); no agent code changes.
