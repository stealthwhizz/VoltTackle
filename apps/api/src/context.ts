import {
  createLlmProvider,
  createEmbeddingsProvider,
  createMonitoringProvider,
  createDeploymentProvider,
  createRepoContextProvider,
} from "@volt-tackle/providers";
import type {
  LlmProvider,
  EmbeddingsProvider,
  MonitoringProvider,
  DeploymentProvider,
  RepoContextProvider,
} from "@volt-tackle/providers";
import { createSafetyAdapter } from "@volt-tackle/safety";
import type { SafetyAdapter } from "@volt-tackle/safety";
import { createQdrantClient } from "@volt-tackle/retrieval";
import type { QdrantClient } from "@qdrant/js-client-rest";
import { createLogger, getTracer, type Logger } from "@volt-tackle/observability";
import type { Tracer } from "@opentelemetry/api";
import type { Env } from "./env.js";

export interface AppContext {
  env: Env;
  logger: Logger;
  tracer: Tracer;
  llmProvider: LlmProvider;
  embeddingsProvider: EmbeddingsProvider;
  monitoringProvider: MonitoringProvider;
  deploymentProvider: DeploymentProvider;
  repoContextProvider: RepoContextProvider;
  safetyAdapter: SafetyAdapter;
  qdrantClient: QdrantClient;
}

export function buildContext(env: Env): AppContext {
  const logger = createLogger({ name: "volt-tackle-api" });

  return {
    env,
    logger,
    tracer: getTracer("volt-tackle-api"),
    llmProvider: createLlmProvider({
      provider: env.LLM_PROVIDER,
      openaiApiKey: env.OPENAI_API_KEY,
      openaiModel: env.OPENAI_MODEL,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      anthropicModel: env.ANTHROPIC_MODEL,
      featherlessApiKey: env.FEATHERLESS_API_KEY,
      featherlessModel: env.FEATHERLESS_MODEL,
      featherlessBaseUrl: env.FEATHERLESS_BASE_URL,
    }),
    embeddingsProvider: createEmbeddingsProvider({
      provider: env.EMBEDDINGS_PROVIDER,
      openaiApiKey: env.OPENAI_API_KEY,
    }),
    monitoringProvider: createMonitoringProvider({
      provider: env.MONITORING_PROVIDER,
      datadogApiKey: env.DATADOG_API_KEY,
      datadogAppKey: env.DATADOG_APP_KEY,
      prometheusUrl: env.PROMETHEUS_URL,
    }),
    deploymentProvider: createDeploymentProvider({
      provider: env.DEPLOYMENT_PROVIDER,
      githubToken: env.GITHUB_TOKEN,
      githubRepo: env.GITHUB_REPO,
    }),
    repoContextProvider: createRepoContextProvider({
      provider: env.REPO_CONTEXT_PROVIDER,
      repoMap: parseRepoMap(env.INCIDENT_REPO_MAP),
      githubToken: env.GITHUB_TOKEN,
      logger,
      gitAgentBin: env.GITAGENT_BIN,
      ...resolveGitAgentLlm(env),
      gitAgentOpenAiBaseUrl: env.GITAGENT_OPENAI_BASE_URL,
    }),
    safetyAdapter: createSafetyAdapter({
      provider: env.SAFETY_PROVIDER,
      enkryptApiKey: env.ENKRYPT_API_KEY,
      enkryptBaseUrl: env.ENKRYPT_BASE_URL,
    }),
    qdrantClient: createQdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY }),
  };
}

/**
 * Resolves the LLM gitagent's own agent loop should use. Prefers an explicit
 * GITAGENT_MODEL + GITAGENT_LLM_API_KEY; otherwise, if Lyzr creds are present,
 * builds the gitarch-style model string "lyzr:<agentId>@<lyzrBaseUrl>".
 */
function resolveGitAgentLlm(env: Env): { gitAgentModel?: string; gitAgentLlmApiKey?: string } {
  if (env.GITAGENT_MODEL && env.GITAGENT_LLM_API_KEY) {
    return { gitAgentModel: env.GITAGENT_MODEL, gitAgentLlmApiKey: env.GITAGENT_LLM_API_KEY };
  }
  if (env.LYZR_API_KEY && env.GITAGENT_LYZR_AGENT_ID) {
    return {
      gitAgentModel: `lyzr:${env.GITAGENT_LYZR_AGENT_ID}@${env.LYZR_BASE_URL}`,
      gitAgentLlmApiKey: env.LYZR_API_KEY,
    };
  }
  return { gitAgentModel: env.GITAGENT_MODEL, gitAgentLlmApiKey: env.GITAGENT_LLM_API_KEY };
}

function parseRepoMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
