export type MonitoringProviderName = "datadog" | "prometheus" | "mock";

export interface MonitoringSnapshotRequest {
  service: string;
  sinceMinutes: number;
}

export interface MonitoringSnapshot {
  service: string;
  metrics: Record<string, number>;
  logs: string[];
  provider: MonitoringProviderName;
  fetchedAt: string;
}

export interface MonitoringProvider {
  readonly name: MonitoringProviderName;
  getSnapshot(request: MonitoringSnapshotRequest): Promise<MonitoringSnapshot>;
}
