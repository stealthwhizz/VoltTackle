import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRootDir = path.resolve(__dirname, "..");

for (const envPath of [
  path.resolve(apiRootDir, ".env"),
  path.resolve(apiRootDir, ".env.local"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "apps/api/.env"),
  path.resolve(process.cwd(), "apps/api/.env.local"),
]) {
  loadDotenv({ path: envPath, override: false });
}

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),

  QDRANT_URL: z.string().default("http://localhost:6333"),
  QDRANT_API_KEY: z.string().optional(),

  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("volt-tackle-api"),
  KAFKA_ALERTS_TOPIC: z.string().default("alerts.raw"),
  KAFKA_CONSUMER_GROUP: z.string().default("volt-tackle-alert-processor"),
  KAFKA_DISABLED: z.coerce.boolean().default(false),

  JWT_SECRET: z.string().min(1).default("dev-only-change-me-in-production"),
  JWT_EXPIRES_IN: z.string().default("12h"),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  FEATHERLESS_API_KEY: z.string().optional(),
  FEATHERLESS_MODEL: z.string().optional(),
  FEATHERLESS_BASE_URL: z.string().optional(),
  LLM_PROVIDER: z.enum(["openai", "anthropic", "featherless", "mock"]).default("mock"),
  EMBEDDINGS_PROVIDER: z.enum(["openai", "mock"]).default("mock"),

  ENKRYPT_API_KEY: z.string().optional(),
  ENKRYPT_BASE_URL: z.string().optional(),
  SAFETY_PROVIDER: z.enum(["enkrypt", "mock"]).default("mock"),

  MONITORING_PROVIDER: z.enum(["datadog", "prometheus", "mock"]).default("mock"),
  DATADOG_API_KEY: z.string().optional(),
  DATADOG_APP_KEY: z.string().optional(),
  PROMETHEUS_URL: z.string().optional(),

  DEPLOYMENT_PROVIDER: z.enum(["github", "gitlab", "mock"]).default("mock"),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_REPO: z.string().optional(),

  // ---- Repo context layer (GitAgent) ----
  REPO_CONTEXT_PROVIDER: z.enum(["gitagent", "local-git", "mock", "none"]).default("none"),
  // JSON map of service -> repo URL or local path, e.g.
  // {"checkout-api":"https://github.com/acme/checkout-api"}
  INCIDENT_REPO_MAP: z.string().optional(),
  GITAGENT_BIN: z.string().default("gitagent"),
  GITAGENT_LLM_API_KEY: z.string().optional(),
  GITAGENT_MODEL: z.string().optional(),
  GITAGENT_OPENAI_BASE_URL: z.string().optional(),
  // Lyzr convenience (matches the gitarch convention): when both are set they
  // build model "lyzr:<agentId>@https://agent-prod.studio.lyzr.ai/v4".
  LYZR_API_KEY: z.string().optional(),
  GITAGENT_LYZR_AGENT_ID: z.string().optional(),
  LYZR_BASE_URL: z.string().default("https://agent-prod.studio.lyzr.ai/v4"),

  OTEL_SERVICE_NAME: z.string().default("volt-tackle-api"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_TRACES_CONSOLE: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}
