import { z } from "zod";
import { IncidentSeveritySchema } from "./enums.js";

/**
 * Normalized shape accepted by POST /api/webhooks/alerts.
 * Real Datadog/Prometheus payloads are adapted into this shape by the
 * monitoring provider adapter before hitting the queue — see packages/providers.
 */
export const AlertWebhookPayloadSchema = z.object({
  source: z.enum(["datadog", "prometheus", "manual", "other"]),
  externalId: z.string().min(1),
  alertName: z.string().min(1),
  service: z.string().min(1),
  severity: IncidentSeveritySchema.default("SEV3"),
  message: z.string().min(1),
  metricValue: z.number().optional(),
  tags: z.array(z.string()).default([]),
  firedAt: z.string().datetime().optional(),
  raw: z.record(z.unknown()).optional(),
});
export type AlertWebhookPayload = z.infer<typeof AlertWebhookPayloadSchema>;

export const AlertQueueMessageSchema = AlertWebhookPayloadSchema.extend({
  receivedAt: z.string().datetime(),
  correlationId: z.string().uuid(),
});
export type AlertQueueMessage = z.infer<typeof AlertQueueMessageSchema>;
