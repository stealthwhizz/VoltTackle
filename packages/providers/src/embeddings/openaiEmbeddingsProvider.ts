import type { EmbeddingsProvider } from "./types.js";

export interface OpenAiEmbeddingsConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface OpenAiEmbeddingsResponse {
  data: Array<{ embedding: number[] }>;
}

export class OpenAiEmbeddingsProvider implements EmbeddingsProvider {
  readonly name = "openai" as const;
  readonly dimensions = 1536;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(private readonly config: OpenAiEmbeddingsConfig) {
    this.model = config.model ?? "text-embedding-3-small";
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector as number[];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings error ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as OpenAiEmbeddingsResponse;
    return payload.data.map((d) => d.embedding);
  }
}
