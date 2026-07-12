import type { MonitoringProvider, MonitoringSnapshot, MonitoringSnapshotRequest } from "./types.js";

export interface PrometheusProviderConfig {
  baseUrl: string;
}

interface PrometheusQueryResponse {
  data: { result: Array<{ value: [number, string] }> };
}

/**
 * Real Prometheus adapter — queries the HTTP query API directly via fetch.
 */
export class PrometheusMonitoringProvider implements MonitoringProvider {
  readonly name = "prometheus" as const;

  constructor(private readonly config: PrometheusProviderConfig) {}

  async getSnapshot(request: MonitoringSnapshotRequest): Promise<MonitoringSnapshot> {
    const errorRate = await this.query(
      `sum(rate(http_requests_total{service="${request.service}",status=~"5.."}[${request.sinceMinutes}m])) / sum(rate(http_requests_total{service="${request.service}"}[${request.sinceMinutes}m]))`,
    );
    const p99Latency = await this.query(
      `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service="${request.service}"}[${request.sinceMinutes}m])) by (le))`,
    );

    return {
      service: request.service,
      provider: "prometheus",
      fetchedAt: new Date().toISOString(),
      metrics: {
        error_rate: errorRate ?? 0,
        p99_latency_seconds: p99Latency ?? 0,
      },
      logs: [],
    };
  }

  private async query(promql: string): Promise<number | null> {
    const response = await fetch(`${this.config.baseUrl}/api/v1/query?query=${encodeURIComponent(promql)}`);
    if (!response.ok) {
      throw new Error(`Prometheus query failed: ${response.status} ${await response.text()}`);
    }
    const payload = (await response.json()) as PrometheusQueryResponse;
    const value = payload.data.result[0]?.value?.[1];
    return value !== undefined ? Number(value) : null;
  }
}
