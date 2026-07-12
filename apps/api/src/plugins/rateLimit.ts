import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

/**
 * Registers a generous global default; routes that need tighter limits
 * (webhook ingestion, human decision actions) set their own `config.rateLimit`
 * per-route, which @fastify/rate-limit merges over this default.
 */
export default fp(async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    allowList: [],
  });
});
