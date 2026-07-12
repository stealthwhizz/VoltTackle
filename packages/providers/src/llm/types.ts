import type { z } from "zod";

export type LlmProviderName = "openai" | "anthropic" | "featherless" | "mock";

export interface LlmCallMetadata {
  provider: LlmProviderName;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  retries: number;
}

export interface GenerateStructuredRequest<T extends z.ZodTypeAny> {
  schema: T;
  schemaName: string;
  system: string;
  prompt: string;
  maxRetries?: number;
}

export interface GenerateStructuredResult<T> {
  data: T;
  meta: LlmCallMetadata;
}

export class LlmGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LlmGenerationError";
  }
}

/**
 * Clean provider-agnostic seam for structured LLM generation. Every agent
 * depends only on this interface, never on a concrete OpenAI/Anthropic SDK.
 */
export interface LlmProvider {
  readonly name: LlmProviderName;
  generateStructured<T extends z.ZodTypeAny>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResult<z.infer<T>>>;
}
