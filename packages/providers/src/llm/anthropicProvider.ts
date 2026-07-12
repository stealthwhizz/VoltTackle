import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { GenerateStructuredRequest, GenerateStructuredResult, LlmProvider } from "./types.js";
import { LlmGenerationError } from "./types.js";

export interface AnthropicProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface AnthropicMessageResponse {
  content: Array<{ type: string; input?: unknown }>;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Real Anthropic adapter. Uses forced tool-use (tool_choice) so Claude must
 * emit arguments matching the Zod-derived JSON schema — more reliable than
 * asking for freeform JSON in the prompt.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(private readonly config: AnthropicProviderConfig) {
    this.model = config.model ?? "claude-3-5-sonnet-20241022";
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com/v1";
  }

  async generateStructured<T extends z.ZodTypeAny>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResult<z.infer<T>>> {
    const start = Date.now();
    const maxRetries = request.maxRetries ?? 2;
    const jsonSchema = zodToJsonSchema(request.schema, request.schemaName);
    const toolName = "emit_structured_result";

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const correctionNote =
        attempt === 0 ? "" : `\n\nYour previous response was invalid: ${String(lastError)}. Try again.`;

      try {
        const response = await fetch(`${this.baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 2048,
            system: request.system,
            messages: [{ role: "user", content: `${request.prompt}${correctionNote}` }],
            tools: [
              {
                name: toolName,
                description: `Emit the structured result for ${request.schemaName}`,
                input_schema: jsonSchema,
              },
            ],
            tool_choice: { type: "tool", name: toolName },
          }),
        });

        if (!response.ok) {
          throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
        }

        const payload = (await response.json()) as AnthropicMessageResponse;
        const toolUse = payload.content.find((block) => block.type === "tool_use");
        if (!toolUse) throw new Error("Anthropic response contained no tool_use block");

        const data = request.schema.parse(toolUse.input) as z.infer<T>;

        return {
          data,
          meta: {
            provider: "anthropic",
            model: this.model,
            promptTokens: payload.usage?.input_tokens ?? null,
            completionTokens: payload.usage?.output_tokens ?? null,
            latencyMs: Date.now() - start,
            retries: attempt,
          },
        };
      } catch (err) {
        lastError = err;
      }
    }

    throw new LlmGenerationError(
      `Anthropic structured generation failed after ${maxRetries + 1} attempts for schema "${request.schemaName}"`,
      lastError,
    );
  }
}
