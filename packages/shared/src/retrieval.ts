import { z } from "zod";
import { IncidentCategorySchema, IncidentSeveritySchema, SourceTypeSchema } from "./enums.js";

/**
 * Payload metadata stored alongside every Qdrant vector point.
 */
export const RetrievalPayloadSchema = z.object({
  sourceType: SourceTypeSchema,
  service: z.string().nullable(),
  incidentCategory: IncidentCategorySchema.nullable(),
  severity: IncidentSeveritySchema.nullable(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  externalRef: z.string(),
  title: z.string(),
  snippet: z.string(),
});
export type RetrievalPayload = z.infer<typeof RetrievalPayloadSchema>;

export const RetrievalMatchSchema = RetrievalPayloadSchema.extend({
  id: z.string(),
  score: z.number(),
});
export type RetrievalMatch = z.infer<typeof RetrievalMatchSchema>;

export const RetrievalResultSchema = z.object({
  query: z.string(),
  matches: z.array(RetrievalMatchSchema),
  summary: z.string(),
});
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;
