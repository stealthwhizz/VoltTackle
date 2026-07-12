import { z } from "zod";
import {
  ApprovalActionSchema,
  DecisionOutcomeSchema,
  IncidentCategorySchema,
  IncidentSeveritySchema,
  IncidentStatusSchema,
  PostmortemStatusSchema,
  RiskLabelSchema,
  SafetyVerdictSchema,
} from "./enums.js";

export const IncidentDtoSchema = z.object({
  id: z.string().uuid(),
  correlationId: z.string().uuid(),
  title: z.string(),
  service: z.string(),
  source: z.string(),
  externalId: z.string(),
  status: IncidentStatusSchema,
  category: IncidentCategorySchema.nullable(),
  severity: IncidentSeveritySchema,
  description: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});
export type IncidentDto = z.infer<typeof IncidentDtoSchema>;

export const IncidentEventDtoSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  type: z.string(),
  actor: z.string(),
  message: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});
export type IncidentEventDto = z.infer<typeof IncidentEventDtoSchema>;

export const IncidentRecommendationDtoSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  rootCauseHypothesis: z.string(),
  rootCauseConfidence: z.number(),
  summary: z.string(),
  actionSteps: z.array(z.object({ order: z.number(), description: z.string() })),
  riskLabel: RiskLabelSchema,
  rollbackGuidance: z.string(),
  confidenceScore: z.number(),
  groundedReferences: z.array(z.string()),
  safetyVerdict: SafetyVerdictSchema.nullable(),
  safetyFlags: z.array(z.record(z.unknown())),
  decisionOutcome: DecisionOutcomeSchema.nullable(),
  promptVersion: z.string(),
  createdAt: z.string().datetime(),
});
export type IncidentRecommendationDto = z.infer<typeof IncidentRecommendationDtoSchema>;

export const ApprovalDtoSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  recommendationId: z.string().uuid(),
  action: ApprovalActionSchema,
  actorId: z.string().uuid(),
  actorName: z.string(),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ApprovalDto = z.infer<typeof ApprovalDtoSchema>;

export const PostmortemDtoSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  impact: z.string(),
  rootCause: z.string(),
  timeline: z.array(z.object({ timestamp: z.string().datetime(), label: z.string() })),
  actionItems: z.array(z.object({ description: z.string(), owner: z.string().nullable() })),
  status: PostmortemStatusSchema,
  promptVersion: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PostmortemDto = z.infer<typeof PostmortemDtoSchema>;

export const IncidentDetailDtoSchema = IncidentDtoSchema.extend({
  events: z.array(IncidentEventDtoSchema),
  recommendations: z.array(IncidentRecommendationDtoSchema),
  approvals: z.array(ApprovalDtoSchema),
  postmortem: PostmortemDtoSchema.nullable(),
});
export type IncidentDetailDto = z.infer<typeof IncidentDetailDtoSchema>;

/* ------------------------------------------------------------------ */
/* Route input schemas                                                */
/* ------------------------------------------------------------------ */
export const ListIncidentsQuerySchema = z.object({
  status: IncidentStatusSchema.optional(),
  category: IncidentCategorySchema.optional(),
  service: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListIncidentsQuery = z.infer<typeof ListIncidentsQuerySchema>;

export const IncidentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const ApprovalActionInputSchema = z.object({
  recommendationId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
});
export type ApprovalActionInput = z.infer<typeof ApprovalActionInputSchema>;
