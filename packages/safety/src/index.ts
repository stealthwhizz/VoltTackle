import type { SafetyAdapter, SafetyAdapterName } from "./types.js";
import { MockEnkryptAdapter } from "./mockEnkryptAdapter.js";
import { RealEnkryptAdapter } from "./realEnkryptAdapter.js";

export * from "./types.js";
export { MockEnkryptAdapter } from "./mockEnkryptAdapter.js";
export { RealEnkryptAdapter } from "./realEnkryptAdapter.js";

export interface SafetyAdapterFactoryConfig {
  provider: SafetyAdapterName;
  enkryptApiKey?: string;
  enkryptBaseUrl?: string;
}

export function createSafetyAdapter(config: SafetyAdapterFactoryConfig): SafetyAdapter {
  if (config.provider === "enkrypt" && config.enkryptApiKey) {
    return new RealEnkryptAdapter({ apiKey: config.enkryptApiKey, baseUrl: config.enkryptBaseUrl });
  }
  return new MockEnkryptAdapter();
}
