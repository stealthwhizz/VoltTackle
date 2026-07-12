import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { GenerateStructuredRequest, GenerateStructuredResult, LlmProvider } from "./types.js";
import { LlmGenerationError } from "./types.js";

export interface FeatherlessProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface OpenAiCompatibleResponse {
  choices: Array<{ message: { content: string | null } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

/**
 * Featherless AI adapter. Featherless exposes an OpenAI-compatible
 * /chat/completions endpoint (https://api.featherless.ai/v1) serving many
 * open-weight models, authed with a Bearer token.
 *
 * Unlike the OpenAI adapter this does NOT rely on `response_format:
 * json_object` — most open models Featherless serves don't implement that
 * mode. Instead it instructs the model to emit only JSON, then robustly
 * extracts the first JSON object from the reply (stripping ``` fences and any
 * prose preamble) and validates it with Zod inside a bounded retry loop.
 */
export class FeatherlessLlmProvider implements LlmProvider {
  readonly name = "featherless" as const;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(private readonly config: FeatherlessProviderConfig) {
    this.model = config.model ?? "Qwen/Qwen2.5-7B-Instruct";
    this.baseUrl = config.baseUrl ?? "https://api.featherless.ai/v1";
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
          : `\n\nYour previous reply could not be parsed as valid JSON for the schema (${String(lastError)}). Reply with ONLY the JSON object, no prose, no code fences.`;

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content: `${request.system}\n\nYou MUST respond with ONLY a single JSON object matching this JSON schema. No markdown, no code fences, no explanation before or after.\nSchema:\n${JSON.stringify(jsonSchema)}`,
              },
              { role: "user", content: `${request.prompt}${correctionNote}` },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Featherless API error ${response.status}: ${await response.text()}`);
        }

        const payload = (await response.json()) as OpenAiCompatibleResponse;
        promptTokens = payload.usage?.prompt_tokens ?? null;
        completionTokens = payload.usage?.completion_tokens ?? null;

        const content = payload.choices[0]?.message.content;
        if (!content) throw new Error("Featherless response contained no content");

        const parsed = JSON.parse(extractJsonObject(content));
        const data = request.schema.parse(parsed) as z.infer<T>;

        return {
          data,
          meta: {
            provider: "featherless",
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
      `Featherless structured generation failed after ${maxRetries + 1} attempts for schema "${request.schemaName}"`,
      lastError,
    );
  }
}

/**
 * Pulls the first balanced JSON object out of a model reply that may wrap it
 * in ```json fences or surround it with prose.
 */
export function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;

  const startIndex = candidate.indexOf("{");
  if (startIndex === -1) return candidate.trim();

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(startIndex, i + 1);
    }
  }
  return candidate.slice(startIndex).trim();
}
