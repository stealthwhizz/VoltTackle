import { z } from "zod";

export const IncidentCategory = {
  DEPLOY_REGRESSION: "DEPLOY_REGRESSION",
  INFRA_FAILURE: "INFRA_FAILURE",
  DEPENDENCY_OUTAGE: "DEPENDENCY_OUTAGE",
  SUSPICIOUS_TRAFFIC: "SUSPICIOUS_TRAFFIC",
} as const;
export const IncidentCategorySchema = z.nativeEnum(IncidentCategory);
export type IncidentCategory = z.infer<typeof IncidentCategorySchema>;

export const IncidentSeverity = {
  SEV1: "SEV1",
  SEV2: "SEV2",
  SEV3: "SEV3",
  SEV4: "SEV4",
} as const;
export const IncidentSeveritySchema = z.nativeEnum(IncidentSeverity);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentStatus = {
  NEW: "NEW",
  TRIAGING: "TRIAGING",
  RETRIEVING_CONTEXT: "RETRIEVING_CONTEXT",
  ANALYZING: "ANALYZING",
  AWAITING_APPROVAL: "AWAITING_APPROVAL",
  APPROVED: "APPROVED",
  ESCALATED: "ESCALATED",
  BLOCKED: "BLOCKED",
  RESOLVED: "RESOLVED",
  POSTMORTEM_DRAFTED: "POSTMORTEM_DRAFTED",
  CLOSED: "CLOSED",
} as const;
export const IncidentStatusSchema = z.nativeEnum(IncidentStatus);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const DecisionOutcome = {
  APPROVE_FOR_REVIEW: "APPROVE_FOR_REVIEW",
  ESCALATE_TO_HUMAN: "ESCALATE_TO_HUMAN",
  BLOCK_UNSAFE: "BLOCK_UNSAFE",
} as const;
export const DecisionOutcomeSchema = z.nativeEnum(DecisionOutcome);
export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;

export const RiskLabel = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export const RiskLabelSchema = z.nativeEnum(RiskLabel);
export type RiskLabel = z.infer<typeof RiskLabelSchema>;

export const SafetyVerdict = {
  SAFE: "SAFE",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  UNSAFE: "UNSAFE",
} as const;
export const SafetyVerdictSchema = z.nativeEnum(SafetyVerdict);
export type SafetyVerdict = z.infer<typeof SafetyVerdictSchema>;

export const SourceType = {
  INCIDENT: "INCIDENT",
  RUNBOOK: "RUNBOOK",
  SERVICE_DOC: "SERVICE_DOC",
  POSTMORTEM: "POSTMORTEM",
} as const;
export const SourceTypeSchema = z.nativeEnum(SourceType);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ApprovalAction = {
  APPROVE: "APPROVE",
  ESCALATE: "ESCALATE",
  BLOCK: "BLOCK",
} as const;
export const ApprovalActionSchema = z.nativeEnum(ApprovalAction);
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

export const UserRole = {
  ENGINEER: "ENGINEER",
  SENIOR_ENGINEER: "SENIOR_ENGINEER",
  ADMIN: "ADMIN",
} as const;
export const UserRoleSchema = z.nativeEnum(UserRole);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const PostmortemStatus = {
  DRAFT: "DRAFT",
  FINALIZED: "FINALIZED",
} as const;
export const PostmortemStatusSchema = z.nativeEnum(PostmortemStatus);
export type PostmortemStatus = z.infer<typeof PostmortemStatusSchema>;
