import "dotenv/config";
import { initTracing } from "@volt-tackle/observability";
import { loadEnv } from "./env.js";
import { buildContext } from "./context.js";
import { buildApp } from "./app.js";
import { createKafkaClient } from "./kafka/client.js";
import { AlertProducer } from "./kafka/producer.js";
import { AlertConsumer } from "./kafka/consumer.js";

async function main() {
  const env = loadEnv();

  const shutdownTracing = initTracing({
    serviceName: env.OTEL_SERVICE_NAME,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    consoleExporter: env.OTEL_TRACES_CONSOLE,
  });

  const ctx = buildContext(env);
  ctx.logger.info(
    {
      llmProvider: ctx.llmProvider.name,
      embeddingsProvider: ctx.embeddingsProvider.name,
      safetyProvider: ctx.safetyAdapter.name,
      monitoringProvider: ctx.monitoringProvider.name,
      deploymentProvider: ctx.deploymentProvider.name,
      kafkaDisabled: env.KAFKA_DISABLED,
    },
    "Starting Volt Tackle API",
  );

  const kafka = createKafkaClient(env);
  const producer = new AlertProducer(kafka, env);
  let consumer: AlertConsumer | undefined;

  if (!env.KAFKA_DISABLED) {
    await producer.connect();
    consumer = new AlertConsumer(kafka, env, ctx);
    await consumer.start();
  }

  const app = await buildApp(ctx, producer);

  await app.listen({ port: env.PORT, host: env.HOST });
  ctx.logger.info({ port: env.PORT, host: env.HOST }, "Volt Tackle API listening");

  const shutdown = async (signal: string) => {
    ctx.logger.info({ signal }, "Shutting down Volt Tackle API");
    await app.close();
    if (!env.KAFKA_DISABLED) {
      await producer.disconnect();
      await consumer?.stop();
    }
    await shutdownTracing();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal error starting Volt Tackle API:", err);
  process.exit(1);
});
