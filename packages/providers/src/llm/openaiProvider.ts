import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { GenerateStructuredRequest, GenerateStructuredResult, LlmProvider } from "./types.js";
import { LlmGenerationError } from "./types.js";

export interface OpenAiProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string | null } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

/**
 * Real OpenAI adapter. Uses response_format=json_object (broadly compatible
 * across GPT-4o family) plus a JSON-schema hint in the system prompt and
 * client-side Zod validation with a bounded retry loop — deliberately not
 * relying on strict json_schema mode, whose additionalProperties/required
 * constraints are easy to violate silently when generated from a Zod schema.
 */
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = "openai" as const;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(private readonly config: OpenAiProviderConfig) {
    this.model = config.model ?? "gpt-4o";
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  }

  async generateStructured<T extends z.ZodTypeAny>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResult<z.infer<T>>> {
    const start = Date.now();
    const maxRetries = request.maxRetries ?? 2;
    const jsonSchema = zodToJsonSchema(request.schema, request.schemaName);

    let lastError: unknown;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const correctionNote =
        attempt === 0
          ? ""
          : `\n\nYour previous response was invalid: ${String(lastError)}. Return corrected JSON only.`;

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `${request.system}\n\nRespond with ONLY a JSON object matching this schema:\n${JSON.stringify(jsonSchema)}`,
              },
              { role: "user", content: `${request.prompt}${correctionNote}` },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
        }

        const payload = (await response.json()) as OpenAiChatResponse;
        promptTokens = payload.usage?.prompt_tokens ?? null;
        completionTokens = payload.usage?.completion_tokens ?? null;

        const content = payload.choices[0]?.message.content;
        if (!content) throw new Error("OpenAI response contained no content");

        const parsed = JSON.parse(content);
        const data = request.schema.parse(parsed) as z.infer<T>;

        return {
          data,
          meta: {
            provider: "openai",
            model: this.model,
            promptTokens,
            completionTokens,
            latencyMs: Date.now() - start,
            retries: attempt,
          },
        };
      } catch (err) {
        lastError = err;
      }
    }

    throw new LlmGenerationError(
      `OpenAI structured generation failed after ${maxRetries + 1} attempts for schema "${request.schemaName}"`,
      lastError,
    );
  }
}
