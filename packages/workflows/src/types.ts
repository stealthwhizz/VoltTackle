import type {
  LlmProvider,
  EmbeddingsProvider,
  MonitoringProvider,
  DeploymentProvider,
  RepoContextProvider,
} from "@volt-tackle/providers";
import type { SafetyAdapter } from "@volt-tackle/safety";
import type { Logger } from "@volt-tackle/observability";
import type { Tracer } from "@opentelemetry/api";
import type { QdrantClient } from "@qdrant/js-client-rest";

export interface WorkflowDeps {
  llmProvider: LlmProvider;
  embeddingsProvider: EmbeddingsProvider;
  monitoringProvider: MonitoringProvider;
  deploymentProvider: DeploymentProvider;
  repoContextProvider: RepoContextProvider;
  safetyAdapter: SafetyAdapter;
  qdrantClient: QdrantClient;
  logger: Logger;
  tracer: Tracer;
}
