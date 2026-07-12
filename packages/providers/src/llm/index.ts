import type { LlmProvider, LlmProviderName } from "./types.js";
import { MockLlmProvider } from "./mockLlmProvider.js";
import { OpenAiLlmProvider } from "./openaiProvider.js";
import { AnthropicLlmProvider } from "./anthropicProvider.js";
import { FeatherlessLlmProvider } from "./featherlessProvider.js";

export * from "./types.js";
export { MockLlmProvider } from "./mockLlmProvider.js";
export { OpenAiLlmProvider } from "./openaiProvider.js";
export { AnthropicLlmProvider } from "./anthropicProvider.js";
export { FeatherlessLlmProvider } from "./featherlessProvider.js";

export interface LlmProviderFactoryConfig {
  provider: LlmProviderName;
  openaiApiKey?: string;
  openaiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  featherlessApiKey?: string;
  featherlessModel?: string;
  featherlessBaseUrl?: string;
}

export function createLlmProvider(config: LlmProviderFactoryConfig): LlmProvider {
  if (config.provider === "openai" && config.openaiApiKey) {
    return new OpenAiLlmProvider({ apiKey: config.openaiApiKey, model: config.openaiModel });
  }
  if (config.provider === "anthropic" && config.anthropicApiKey) {
    return new AnthropicLlmProvider({ apiKey: config.anthropicApiKey, model: config.anthropicModel });
  }
  if (config.provider === "featherless" && config.featherlessApiKey) {
    return new FeatherlessLlmProvider({
      apiKey: config.featherlessApiKey,
      model: config.featherlessModel,
      baseUrl: config.featherlessBaseUrl,
    });
  }
  return new MockLlmProvider();
}
