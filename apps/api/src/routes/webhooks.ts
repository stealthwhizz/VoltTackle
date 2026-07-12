import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AlertWebhookPayloadSchema } from "@volt-tackle/shared";
import { ingestAlert } from "../lib/alertIngestion.js";

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/webhooks/alerts",
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parsed = AlertWebhookPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "ValidationError", issues: parsed.error.issues });
      }

      if (fastify.ctx.env.KAFKA_DISABLED) {
        const result = await ingestAlert(parsed.data, fastify.ctx, randomUUID());
        return reply.code(202).send({ accepted: true, mode: "inline", ...result });
      }

      const message = await fastify.alertProducer.publish(parsed.data);
      return reply.code(202).send({ accepted: true, mode: "queued", correlationId: message.correlationId });
    },
  );
}
