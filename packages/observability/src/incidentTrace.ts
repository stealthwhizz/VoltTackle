import { SpanStatusCode, type Span, type Tracer } from "@opentelemetry/api";

/**
 * Standardized span attribute names used across the incident pipeline so
 * traces/logs stay queryable by incident correlation ID regardless of which
 * agent or workflow step emitted them.
 */
export const OTEL_ATTR = {
  INCIDENT_ID: "volttackle.incident_id",
  CORRELATION_ID: "volttackle.correlation_id",
  AGENT_NAME: "volttackle.agent_name",
  PROMPT_VERSION: "volttackle.prompt_version",
  LLM_PROVIDER: "volttackle.llm_provider",
  LLM_MODEL: "volttackle.llm_model",
  TOKENS_PROMPT: "volttackle.tokens.prompt",
  TOKENS_COMPLETION: "volttackle.tokens.completion",
  RETRIEVAL_LATENCY_MS: "volttackle.retrieval.latency_ms",
  RETRIEVAL_MATCH_COUNT: "volttackle.retrieval.match_count",
  SAFETY_VERDICT: "volttackle.safety.verdict",
  DECISION_OUTCOME: "volttackle.decision.outcome",
  WORKFLOW_NAME: "volttackle.workflow_name",
} as const;

export interface AgentSpanAttributes {
  incidentId: string;
  correlationId: string;
  agentName: string;
  promptVersion: string;
}

export async function withAgentSpan<T>(
  tracer: Tracer,
  attrs: AgentSpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(`agent.${attrs.agentName}`, async (span) => {
    span.setAttributes({
      [OTEL_ATTR.INCIDENT_ID]: attrs.incidentId,
      [OTEL_ATTR.CORRELATION_ID]: attrs.correlationId,
      [OTEL_ATTR.AGENT_NAME]: attrs.agentName,
      [OTEL_ATTR.PROMPT_VERSION]: attrs.promptVersion,
    });
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function withWorkflowSpan<T>(
  tracer: Tracer,
  attrs: { incidentId: string; correlationId: string; workflowName: string },
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(`workflow.${attrs.workflowName}`, async (span) => {
    span.setAttributes({
      [OTEL_ATTR.INCIDENT_ID]: attrs.incidentId,
      [OTEL_ATTR.CORRELATION_ID]: attrs.correlationId,
      [OTEL_ATTR.WORKFLOW_NAME]: attrs.workflowName,
    });
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

export function recordLlmUsage(
  span: Span,
  usage: { provider: string; model: string; promptTokens: number | null; completionTokens: number | null },
) {
  span.setAttributes({
    [OTEL_ATTR.LLM_PROVIDER]: usage.provider,
    [OTEL_ATTR.LLM_MODEL]: usage.model,
    [OTEL_ATTR.TOKENS_PROMPT]: usage.promptTokens ?? -1,
    [OTEL_ATTR.TOKENS_COMPLETION]: usage.completionTokens ?? -1,
  });
}

export function recordRetrievalStats(span: Span, stats: { latencyMs: number; matchCount: number }) {
  span.setAttributes({
    [OTEL_ATTR.RETRIEVAL_LATENCY_MS]: stats.latencyMs,
    [OTEL_ATTR.RETRIEVAL_MATCH_COUNT]: stats.matchCount,
  });
}

export function recordSafetyVerdict(span: Span, verdict: string) {
  span.setAttribute(OTEL_ATTR.SAFETY_VERDICT, verdict);
}

export function recordDecisionOutcome(span: Span, outcome: string) {
  span.setAttribute(OTEL_ATTR.DECISION_OUTCOME, outcome);
}
