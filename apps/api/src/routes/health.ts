import type { FastifyInstance } from "fastify";
import { prisma } from "@volt-tackle/database";

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async (_request, reply) => {
    let dbConnected = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbConnected = false;
    }

    reply.send({
      status: dbConnected ? "ok" : "degraded",
      uptimeSeconds: Math.round(process.uptime()),
      dbConnected,
      llmProvider: fastify.ctx.llmProvider.name,
      llmModel: fastify.ctx.env.LLM_PROVIDER === "featherless" ? fastify.ctx.env.FEATHERLESS_MODEL ?? "(default)" : undefined,
      embeddingsProvider: fastify.ctx.embeddingsProvider.name,
      safetyProvider: fastify.ctx.safetyAdapter.name,
    });
  });
}
