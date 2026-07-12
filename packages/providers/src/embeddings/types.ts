export type EmbeddingsProviderName = "openai" | "mock";

export interface EmbeddingsProvider {
  readonly name: EmbeddingsProviderName;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
