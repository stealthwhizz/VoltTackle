import type { MonitoringProvider, MonitoringSnapshot, MonitoringSnapshotRequest } from "./types.js";

/**
 * Deterministic offline monitoring adapter. Produces plausible metrics/logs
 * for a service without calling Datadog/Prometheus, seeded by service name
 * so repeated calls for the same service are stable within a process.
 */
export class MockMonitoringProvider implements MonitoringProvider {
  readonly name = "mock" as const;

  async getSnapshot(request: MonitoringSnapshotRequest): Promise<MonitoringSnapshot> {
    const seed = hashString(request.service);

    const errorRatePct = round(2 + (seed % 25), 2);
    const p99LatencyMs = 180 + (seed % 900);
    const cpuUtilizationPct = round(30 + (seed % 55), 1);
    const memoryUtilizationPct = round(35 + ((seed >> 3) % 50), 1);

    return {
      service: request.service,
      provider: "mock",
      fetchedAt: new Date().toISOString(),
      metrics: {
        error_rate_pct: errorRatePct,
        p99_latency_ms: p99LatencyMs,
        cpu_utilization_pct: cpuUtilizationPct,
        memory_utilization_pct: memoryUtilizationPct,
      },
      logs: [
        `[warn] ${request.service}: elevated error_rate_pct=${errorRatePct} over last ${request.sinceMinutes}m`,
        `[info] ${request.service}: p99_latency_ms=${p99LatencyMs}`,
        `[info] ${request.service}: cpu_utilization_pct=${cpuUtilizationPct} memory_utilization_pct=${memoryUtilizationPct}`,
      ],
    };
  }
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
