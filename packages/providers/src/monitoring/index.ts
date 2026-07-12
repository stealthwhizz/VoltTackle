import type { MonitoringProvider, MonitoringProviderName } from "./types.js";
import { MockMonitoringProvider } from "./mockMonitoringProvider.js";
import { DatadogMonitoringProvider } from "./datadogProvider.js";
import { PrometheusMonitoringProvider } from "./prometheusProvider.js";

export * from "./types.js";
export { MockMonitoringProvider } from "./mockMonitoringProvider.js";
export { DatadogMonitoringProvider } from "./datadogProvider.js";
export { PrometheusMonitoringProvider } from "./prometheusProvider.js";

export interface MonitoringProviderFactoryConfig {
  provider: MonitoringProviderName;
  datadogApiKey?: string;
  datadogAppKey?: string;
  prometheusUrl?: string;
}

export function createMonitoringProvider(config: MonitoringProviderFactoryConfig): MonitoringProvider {
  if (config.provider === "datadog" && config.datadogApiKey && config.datadogAppKey) {
    return new DatadogMonitoringProvider({ apiKey: config.datadogApiKey, appKey: config.datadogAppKey });
  }
  if (config.provider === "prometheus" && config.prometheusUrl) {
    return new PrometheusMonitoringProvider({ baseUrl: config.prometheusUrl });
  }
  return new MockMonitoringProvider();
}
