import type { FastifyInstance } from "fastify";
import { RepoAnalysisInputSchema } from "@volt-tackle/shared";
import { startRepoAnalysis } from "../lib/repoAnalysis.js";

export default async function repoAnalysisRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/repo-analysis",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const parsed = RepoAnalysisInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "ValidationError", issues: parsed.error.issues });
      }

      const result = await startRepoAnalysis(parsed.data, fastify.ctx);
      return reply.code(202).send({ accepted: true, ...result });
    },
  );
}
