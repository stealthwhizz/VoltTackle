import type { z } from "zod";
import type { GenerateStructuredRequest, GenerateStructuredResult, LlmProvider } from "./types.js";
import { fakeFromSchema } from "./mockSchemaFaker.js";

/**
 * Deterministic, offline LLM adapter. Produces schema-valid, context-aware
 * output via mockSchemaFaker so the full incident pipeline runs end-to-end
 * without any API keys. Selected automatically when LLM_PROVIDER=mock or no
 * provider key is configured.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = "mock" as const;

  async generateStructured<T extends z.ZodTypeAny>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResult<z.infer<T>>> {
    const start = Date.now();
    // Deliberately excludes `system` from the signal: system prompts are
    // static per-agent instructions that often name every possible enum
    // value (e.g. documenting what LOW/MEDIUM/HIGH/CRITICAL each mean),
    // which would saturate keyword-overlap scoring and always pick the
    // first-declared enum value regardless of the actual incident. Only the
    // per-call user prompt carries real per-incident signal.
    const contextText = request.prompt;
    const faked = fakeFromSchema(request.schema, { contextText });
    const data = request.schema.parse(faked) as z.infer<T>;

    return {
      data,
      meta: {
        provider: "mock",
        model: "mock-schema-faker-v1",
        promptTokens: null,
        completionTokens: null,
        latencyMs: Date.now() - start,
        retries: 0,
      },
    };
  }
}
