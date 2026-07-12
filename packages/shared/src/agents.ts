import { z } from "zod";
import { IncidentCategorySchema, IncidentSeveritySchema, RiskLabelSchema, SafetyVerdictSchema } from "./enums.js";
import { RetrievalMatchSchema } from "./retrieval.js";
import { RepoContextSchema } from "./repocontext.js";

/* ------------------------------------------------------------------ */
/* Incident Triage Agent                                              */
/* ------------------------------------------------------------------ */
export const TriageInputSchema = z.object({
  alertName: z.string(),
  service: z.string(),
  message: z.string(),
  severity: z.string(),
  tags: z.array(z.string()),
  recentDeploys: z
    .array(
      z.object({
        sha: z.string(),
        author: z.string(),
        message: z.string(),
        deployedAt: z.string(),
      }),
    )
    .default([]),
});
export type TriageInput = z.infer<typeof TriageInputSchema>;

export const TriageOutputSchema = z.object({
  category: IncidentCategorySchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  signals: z.array(z.string()),
});
export type TriageOutput = z.infer<typeof TriageOutputSchema>;

/* ------------------------------------------------------------------ */
/* Retrieval Summarizer                                               */
/* ------------------------------------------------------------------ */
export const RetrievalSummarizerInputSchema = z.object({
  incidentSummary: z.string(),
  matches: z.array(RetrievalMatchSchema),
});
export type RetrievalSummarizerInput = z.infer<typeof RetrievalSummarizerInputSchema>;

export const RetrievalSummarizerOutputSchema = z.object({
  summary: z.string(),
  mostRelevantRefs: z.array(z.string()),
});
export type RetrievalSummarizerOutput = z.infer<typeof RetrievalSummarizerOutputSchema>;

/* ------------------------------------------------------------------ */
/* Repo Investigator (Featherless generates questions for GitAgent)   */
/* ------------------------------------------------------------------ */
export const RepoInvestigatorInputSchema = z.object({
  repo: z.string(),
  incidentSummary: z.string(),
  category: IncidentCategorySchema,
  recentCommits: z
    .array(z.object({ sha: z.string(), message: z.string() }))
    .default([]),
  maxQuestions: z.number().int().min(1).max(5).default(3),
});
export type RepoInvestigatorInput = z.infer<typeof RepoInvestigatorInputSchema>;

export const RepoInvestigatorOutputSchema = z.object({
  questions: z.array(z.string()).min(1),
});
export type RepoInvestigatorOutput = z.infer<typeof RepoInvestigatorOutputSchema>;

/* ------------------------------------------------------------------ */
/* Root Cause Agent                                                   */
/* ------------------------------------------------------------------ */
export const RootCauseInputSchema = z.object({
  incidentSummary: z.string(),
  category: IncidentCategorySchema,
  retrievalSummary: z.string(),
  retrievalRefs: z.array(z.string()),
  recentDeploys: z
    .array(
      z.object({
        sha: z.string(),
        author: z.string(),
        message: z.string(),
        deployedAt: z.string(),
      }),
    )
    .default([]),
  metrics: z.record(z.number()).default({}),
  // Optional repository context (recent commits / changed files for the
  // impacted service), supplied by a RepoContextProvider when the incident
  // looks code/deploy-related. Additive: absent for non-deploy incidents or
  // when REPO_CONTEXT_PROVIDER=none.
  repoContext: RepoContextSchema.optional(),
});
export type RootCauseInput = z.infer<typeof RootCauseInputSchema>;

export const RootCauseOutputSchema = z.object({
  hypothesis: z.string(),
  confidence: z.number().min(0).max(1),
  supportingEvidence: z.array(z.string()),
  contributingFactors: z.array(z.string()),
  groundedReferences: z.array(z.string()),
});
export type RootCauseOutput = z.infer<typeof RootCauseOutputSchema>;

/* ------------------------------------------------------------------ */
/* Remediation Agent                                                  */
/* ------------------------------------------------------------------ */
export const RemediationInputSchema = z.object({
  incidentSummary: z.string(),
  category: IncidentCategorySchema,
  severity: IncidentSeveritySchema,
  rootCauseHypothesis: z.string(),
  rootCauseConfidence: z.number().min(0).max(1),
  groundedReferences: z.array(z.string()),
  retrievalSummary: z.string().default(""),
  retrievalRefs: z.array(z.string()).default([]),
  repoContext: RepoContextSchema.optional(),
});
export type RemediationInput = z.infer<typeof RemediationInputSchema>;

export const RemediationActionStepSchema = z.object({
  order: z.number().int().min(1),
  description: z.string(),
});

export const RemediationOutputSchema = z.object({
  summary: z.string(),
  actionSteps: z.array(RemediationActionStepSchema).min(1),
  riskLabel: RiskLabelSchema,
  rollbackGuidance: z.string(),
  confidenceScore: z.number().min(0).max(1),
  groundedReferences: z.array(z.string()),
});
export type RemediationOutput = z.infer<typeof RemediationOutputSchema>;

/* ------------------------------------------------------------------ */
/* Safety Validator Agent (Enkrypt)                                   */
/* ------------------------------------------------------------------ */
export const SafetyValidationInputSchema = z.object({
  remediationSummary: z.string(),
  actionSteps: z.array(z.string()),
  rollbackGuidance: z.string(),
  riskLabel: RiskLabelSchema,
});
export type SafetyValidationInput = z.infer<typeof SafetyValidationInputSchema>;

export const SafetyFlagSchema = z.object({
  type: z.enum([
    "destructive_command",
    "hallucination_risk",
    "pii_leak",
    "secret_leak",
    "policy_violation",
    "low_confidence",
    "missing_context",
  ]),
  severity: RiskLabelSchema,
  detail: z.string(),
});
export type SafetyFlag = z.infer<typeof SafetyFlagSchema>;

export const SafetyValidationOutputSchema = z.object({
  verdict: SafetyVerdictSchema,
  flags: z.array(SafetyFlagSchema),
  provider: z.enum(["enkrypt", "mock"]),
  evaluatedAt: z.string().datetime(),
  rationale: z.string(),
});
export type SafetyValidationOutput = z.infer<typeof SafetyValidationOutputSchema>;

/* ------------------------------------------------------------------ */
/* Postmortem Agent                                                   */
/* ------------------------------------------------------------------ */
export const PostmortemInputSchema = z.object({
  incidentSummary: z.string(),
  category: IncidentCategorySchema,
  rootCauseHypothesis: z.string(),
  remediationSummary: z.string(),
  actionStepsTaken: z.array(z.string()),
  decisionOutcome: z.string(),
  timelineEvents: z.array(
    z.object({
      timestamp: z.string().datetime(),
      label: z.string(),
    }),
  ),
});
export type PostmortemInput = z.infer<typeof PostmortemInputSchema>;

export const PostmortemActionItemSchema = z.object({
  description: z.string(),
  owner: z.string().nullable(),
});

export const PostmortemOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  impact: z.string(),
  rootCause: z.string(),
  timeline: z.array(
    z.object({
      timestamp: z.string().datetime(),
      label: z.string(),
    }),
  ),
  actionItems: z.array(PostmortemActionItemSchema),
});
export type PostmortemOutput = z.infer<typeof PostmortemOutputSchema>;
