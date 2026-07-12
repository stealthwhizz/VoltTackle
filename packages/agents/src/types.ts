import type { LlmProvider } from "@volt-tackle/providers";
import type { Logger } from "@volt-tackle/observability";
import type { Tracer } from "@opentelemetry/api";

export interface AgentRunContext {
  incidentId: string;
  correlationId: string;
}

export interface AgentDeps {
  llmProvider: LlmProvider;
  logger: Logger;
  tracer: Tracer;
}

/**
 * Thrown when an agent cannot produce a trustworthy result (LLM failure
 * after retries, schema violation, etc). Callers must treat this as a
 * "fail safe" signal — the workflow catches it and routes the incident to
 * ESCALATE_TO_HUMAN rather than crashing or presenting a fabricated result.
 */
export class AgentExecutionError extends Error {
  constructor(
    public readonly agentName: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${agentName}] ${message}`);
    this.name = "AgentExecutionError";
  }
}
