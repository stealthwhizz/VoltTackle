import type { MonitoringProvider, MonitoringSnapshot, MonitoringSnapshotRequest } from "./types.js";

export interface DatadogProviderConfig {
  apiKey: string;
  appKey: string;
  site?: string;
}

interface DatadogLogsResponse {
  data: Array<{ attributes: { message?: string } }>;
}

/**
 * Real Datadog adapter — queries the Logs and Metrics APIs directly via
 * fetch. Requires DATADOG_API_KEY + DATADOG_APP_KEY; falls back to the mock
 * provider at the factory level when absent.
 */
export class DatadogMonitoringProvider implements MonitoringProvider {
  readonly name = "datadog" as const;
  private readonly baseUrl: string;

  constructor(private readonly config: DatadogProviderConfig) {
    this.baseUrl = `https://api.${config.site ?? "datadoghq.com"}`;
  }

  async getSnapshot(request: MonitoringSnapshotRequest): Promise<MonitoringSnapshot> {
    const [metrics, logs] = await Promise.all([this.fetchMetrics(request), this.fetchLogs(request)]);

    return {
      service: request.service,
      provider: "datadog",
      fetchedAt: new Date().toISOString(),
      metrics,
      logs,
    };
  }

  private headers() {
    return {
      "DD-API-KEY": this.config.apiKey,
      "DD-APPLICATION-KEY": this.config.appKey,
      "Content-Type": "application/json",
    };
  }

  private async fetchMetrics(request: MonitoringSnapshotRequest): Promise<Record<string, number>> {
    const to = Math.floor(Date.now() / 1000);
    const from = to - request.sinceMinutes * 60;
    const query = `avg:trace.http.request.errors{service:${request.service}}`;

    const response = await fetch(
      `${this.baseUrl}/api/v1/query?from=${from}&to=${to}&query=${encodeURIComponent(query)}`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      throw new Error(`Datadog metrics query failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as { series?: Array<{ pointlist: Array<[number, number]> }> };
    const points = payload.series?.[0]?.pointlist ?? [];
    const last = points.at(-1)?.[1] ?? 0;

    return { error_rate: last };
  }

  private async fetchLogs(request: MonitoringSnapshotRequest): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/v2/logs/events/search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        filter: {
          query: `service:${request.service}`,
          from: `now-${request.sinceMinutes}m`,
          to: "now",
        },
        page: { limit: 25 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Datadog logs query failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as DatadogLogsResponse;
    return payload.data.map((entry) => entry.attributes.message ?? "").filter(Boolean);
  }
}
