import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import type { AppContext } from "./context.js";
import type { AlertProducer } from "./kafka/producer.js";
import authPlugin from "./plugins/auth.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import webhookRoutes from "./routes/webhooks.js";
import incidentRoutes from "./routes/incidents.js";
import repoAnalysisRoutes from "./routes/repoAnalysis.js";

export async function buildApp(ctx: AppContext, alertProducer: AlertProducer) {
  const app = Fastify({
    logger: false, // we use @volt-tackle/observability's pino logger via ctx.logger instead
    trustProxy: true,
  });

  app.decorate("ctx", ctx);
  app.decorate("alertProducer", alertProducer);

  await app.register(cors, { origin: ctx.env.CORS_ORIGIN });
  await app.register(sensible);
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);

  app.setErrorHandler<Error & { statusCode?: number }>((error, request, reply) => {
    ctx.logger.error({ err: error, url: request.url }, "Unhandled route error");
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      error: statusCode === 500 ? "InternalServerError" : error.name,
      message: statusCode === 500 ? "Something went wrong." : error.message,
    });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(webhookRoutes);
  await app.register(incidentRoutes);
  await app.register(repoAnalysisRoutes);

  return app;
}
