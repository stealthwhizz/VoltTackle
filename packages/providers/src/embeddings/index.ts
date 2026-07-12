import type { EmbeddingsProvider, EmbeddingsProviderName } from "./types.js";
import { MockEmbeddingsProvider } from "./mockEmbeddingsProvider.js";
import { OpenAiEmbeddingsProvider } from "./openaiEmbeddingsProvider.js";

export * from "./types.js";
export { MockEmbeddingsProvider } from "./mockEmbeddingsProvider.js";
export { OpenAiEmbeddingsProvider } from "./openaiEmbeddingsProvider.js";

export interface EmbeddingsProviderFactoryConfig {
  provider: EmbeddingsProviderName;
  openaiApiKey?: string;
  openaiModel?: string;
}

export function createEmbeddingsProvider(config: EmbeddingsProviderFactoryConfig): EmbeddingsProvider {
  if (config.provider === "openai" && config.openaiApiKey) {
    return new OpenAiEmbeddingsProvider({ apiKey: config.openaiApiKey, model: config.openaiModel });
  }
  return new MockEmbeddingsProvider();
}
