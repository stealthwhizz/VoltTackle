import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { prisma, Prisma } from "@volt-tackle/database";
import { IncidentCategorySchema, RiskLabelSchema, DecisionOutcomeSchema, SafetyVerdictSchema } from "@volt-tackle/shared";
import {
  runTriageAgent,
  runRetrievalSummarizerAgent,
  runRootCauseAgent,
  runRemediationAgent,
  runSafetyValidatorAgent,
  runRepoInvestigatorAgent,
} from "@volt-tackle/agents";
import { retrieveIncidentContext } from "@volt-tackle/retrieval";
import { withWorkflowSpan, recordRetrievalStats, recordDecisionOutcome } from "@volt-tackle/observability";
import type { WorkflowDeps } from "./types.js";

const BaseIO = z.object({ incidentId: z.string(), correlationId: z.string() });

/** Incident categories for which repo/code context is worth fetching. */
const REPO_CONTEXT_CATEGORIES = new Set(["DEPLOY_REGRESSION"]);

const TriageStepOutput = BaseIO.extend({
  category: IncidentCategorySchema,
  triageConfidence: z.number(),
});

const RetrievalStepOutput = TriageStepOutput.extend({
  retrievalSummary: z.string(),
  retrievalRefs: z.array(z.string()),
});

const AnalysisStepOutput = RetrievalStepOutput.extend({
  recommendationId: z.string(),
  remediationSummary: z.string(),
  actionStepDescriptions: z.array(z.string()),
  rollbackGuidance: z.string(),
  riskLabel: RiskLabelSchema,
});

const SafetyStepOutput = BaseIO.extend({
  safetyVerdict: SafetyVerdictSchema,
  decisionOutcome: DecisionOutcomeSchema,
});

/**
 * Builds the full incident-response pipeline as a Mastra workflow:
 * triage -> retrieval -> analysis (RCA + remediation) -> safety/decision
 * gate. Postgres (via Prisma) is the durable source of truth for every
 * side effect; Mastra sequences the steps and threads cumulative state
 * between them, it does not own persistence — see docs/adr for the
 * rationale on keeping Mastra scoped to in-process orchestration.
 */
export function buildIncidentWorkflow(deps: WorkflowDeps) {
  const triageStep = createStep({
    id: "triage",
    inputSchema: BaseIO,
    outputSchema: TriageStepOutput,
    execute: async ({ inputData }) => {
      const { incidentId, correlationId } = inputData;
      const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });

      const [monitoring, deploys] = await Promise.all([
        deps.monitoringProvider.getSnapshot({ service: incident.service, sinceMinutes: 30 }),
        deps.deploymentProvider.getRecentDeploys({ service: incident.service, sinceMinutes: 60 }),
      ]);

      const { output, promptVersion } = await runTriageAgent(
        {
          alertName: incident.title,
          service: incident.service,
          message: `${incident.description} (recent logs: ${monitoring.logs.join(" | ")})`,
          severity: incident.severity,
          tags: incident.tags,
          recentDeploys: deploys,
        },
        deps,
        { incidentId, correlationId },
      );

      await prisma.$transaction([
        prisma.incident.update({ where: { id: incidentId }, data: { category: output.category } }),
        prisma.incidentEvent.create({
          data: {
            incidentId,
            type: "TRIAGE_COMPLETE",
            actor: "agent:triage-agent",
            message: `Classified as ${output.category} (confidence ${output.confidence}).`,
            metadata: { ...output, promptVersion } as unknown as Prisma.InputJsonValue,
          },
        }),
      ]);

      return { incidentId, correlationId, category: output.category, triageConfidence: output.confidence };
    },
  });

  const retrievalStep = createStep({
    id: "retrieval",
    inputSchema: TriageStepOutput,
    outputSchema: RetrievalStepOutput,
    execute: async ({ inputData }) => {
      const { incidentId, correlationId, category, triageConfidence } = inputData;
      await prisma.incident.update({ where: { id: incidentId }, data: { status: "RETRIEVING_CONTEXT" } });
      const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });

      const start = Date.now();
      const matches = await retrieveIncidentContext(deps.qdrantClient, deps.embeddingsProvider, {
        incidentSummary: incident.description,
        service: incident.service,
      });
      const latencyMs = Date.now() - start;

      const { output, promptVersion } = await runRetrievalSummarizerAgent(
        { incidentSummary: incident.description, matches },
        deps,
        { incidentId, correlationId },
      );

      await withWorkflowSpan(deps.tracer, { incidentId, correlationId, workflowName: "incident-response" }, async (span) => {
        recordRetrievalStats(span, { latencyMs, matchCount: matches.length });
      });

      await prisma.incidentEvent.create({
        data: {
          incidentId,
          type: "RETRIEVAL_COMPLETE",
          actor: "agent:retrieval-summarizer",
          message: `Found ${matches.length} similar memory items in ${latencyMs}ms.`,
          metadata: { matchCount: matches.length, latencyMs, summary: output.summary, refs: output.mostRelevantRefs, promptVersion },
        },
      });

      return {
        incidentId,
        correlationId,
        category,
        triageConfidence,
        retrievalSummary: output.summary,
        retrievalRefs: output.mostRelevantRefs,
      };
    },
  });

  const analysisStep = createStep({
    id: "analysis",
    inputSchema: RetrievalStepOutput,
    outputSchema: AnalysisStepOutput,
    execute: async ({ inputData }) => {
      const { incidentId, correlationId, category, retrievalSummary, retrievalRefs } = inputData;
      await prisma.incident.update({ where: { id: incidentId }, data: { status: "ANALYZING" } });
      const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });

      const repoUrl = (incident.rawAlert as { repoUrl?: string } | null)?.repoUrl;

      // For on-demand repo analyses there is no live service to observe, so we
      // skip the (mock) monitoring/deploy signals — they'd otherwise inject
      // fabricated metrics that compete with the real GitAgent findings and
      // dilute the RCA. Real incidents still get the full signal set.
      const [monitoring, deploys] = repoUrl
        ? [{ metrics: {} as Record<string, number>, logs: [] as string[] }, [] as { sha: string; author: string; message: string; deployedAt: string }[]]
        : await Promise.all([
            deps.monitoringProvider.getSnapshot({ service: incident.service, sinceMinutes: 30 }),
            deps.deploymentProvider.getRecentDeploys({ service: incident.service, sinceMinutes: 60 }),
          ]);

      // Optional repo-context layer (GitAgent / local-git / mock). Engaged for
      // code/deploy-related incidents, and always for on-demand repo-analysis
      // incidents (which carry a repoUrl). Otherwise this stays a no-op and the
      // RCA behaves exactly as before.
      const shouldFetchRepo = REPO_CONTEXT_CATEGORIES.has(category) || Boolean(repoUrl);

      // Multi-agent investigation: Featherless generates targeted questions,
      // then the repo-context provider (GitAgent on Lyzr) answers each against
      // the repo history. Only for on-demand repo-analysis incidents (repoUrl),
      // where the deeper archaeology is worth the extra latency.
      let questions: string[] | undefined;
      if (repoUrl) {
        try {
          const investigator = await runRepoInvestigatorAgent(
            { repo: repoUrl, incidentSummary: incident.description, category, recentCommits: [], maxQuestions: 2 },
            deps,
            { incidentId, correlationId },
          );
          questions = investigator.output.questions;
          await prisma.incidentEvent.create({
            data: {
              incidentId,
              type: "REPO_QUESTIONS_GENERATED",
              actor: "agent:repo-investigator",
              message: `Generated ${questions.length} investigation question(s) for GitAgent.`,
              metadata: { questions } as unknown as Prisma.InputJsonValue,
            },
          });
        } catch (err) {
          deps.logger.warn({ err, incidentId }, "Repo investigator failed; GitAgent will run a default analysis.");
        }
      }

      const repoContext = shouldFetchRepo
        ? await deps.repoContextProvider
            .getRepoContext({
              service: incident.service,
              incidentSummary: incident.description,
              category,
              sinceMinutes: 1440,
              ...(repoUrl ? { repoUrl } : {}),
              ...(questions ? { questions } : {}),
            })
            .catch((err) => {
              deps.logger.warn({ err, incidentId }, "Repo context provider failed; continuing without repo context.");
              return undefined;
            })
        : undefined;

      if (repoContext?.available) {
        await prisma.incidentEvent.create({
          data: {
            incidentId,
            type: "REPO_CONTEXT_FETCHED",
            actor: `provider:${repoContext.provider}`,
            message: repoContext.summary,
            metadata: {
              repo: repoContext.repo,
              ref: repoContext.ref,
              commitCount: repoContext.recentCommits.length,
              suspectSignals: repoContext.suspectSignals,
              investigation: repoContext.investigation,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }

      const rca = await runRootCauseAgent(
        {
          incidentSummary: incident.description,
          category,
          retrievalSummary,
          retrievalRefs,
          recentDeploys: deploys,
          metrics: monitoring.metrics,
          ...(repoContext?.available ? { repoContext } : {}),
        },
        deps,
        { incidentId, correlationId },
      );

      const remediation = await runRemediationAgent(
        {
          incidentSummary: incident.description,
          category,
          severity: incident.severity,
          rootCauseHypothesis: rca.output.hypothesis,
          rootCauseConfidence: rca.output.confidence,
          groundedReferences: rca.output.groundedReferences,
          ...(repoContext?.available ? { repoContext } : {}),
        },
        deps,
        { incidentId, correlationId },
      );

      const recommendation = await prisma.incidentRecommendation.create({
        data: {
          incidentId,
          rootCauseHypothesis: rca.output.hypothesis,
          rootCauseConfidence: rca.output.confidence,
          summary: remediation.output.summary,
          actionSteps: remediation.output.actionSteps as unknown as Prisma.InputJsonValue,
          riskLabel: remediation.output.riskLabel,
          rollbackGuidance: remediation.output.rollbackGuidance,
          confidenceScore: remediation.output.confidenceScore,
          groundedReferences: remediation.output.groundedReferences,
          promptVersion: remediation.promptVersion,
        },
      });

      await prisma.incidentEvent.create({
        data: {
          incidentId,
          type: "ANALYSIS_COMPLETE",
          actor: "agent:root-cause-agent+remediation-agent",
          message: `Root cause hypothesis and remediation drafted (risk: ${remediation.output.riskLabel}).`,
          metadata: {
            rootCause: rca.output,
            rootCausePromptVersion: rca.promptVersion,
            remediationPromptVersion: remediation.promptVersion,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        ...inputData,
        recommendationId: recommendation.id,
        remediationSummary: remediation.output.summary,
        actionStepDescriptions: remediation.output.actionSteps.map((s) => s.description),
        rollbackGuidance: remediation.output.rollbackGuidance,
        riskLabel: remediation.output.riskLabel,
      };
    },
  });

  const safetyStep = createStep({
    id: "safety-decision-gate",
    inputSchema: AnalysisStepOutput,
    outputSchema: SafetyStepOutput,
    execute: async ({ inputData }) => {
      const { incidentId, correlationId, recommendationId, remediationSummary, actionStepDescriptions, rollbackGuidance, riskLabel } =
        inputData;

      const safety = await runSafetyValidatorAgent(
        { remediationSummary, actionSteps: actionStepDescriptions, rollbackGuidance, riskLabel },
        { ...deps, safetyAdapter: deps.safetyAdapter },
        { incidentId, correlationId },
      );

      const decisionOutcome: z.infer<typeof DecisionOutcomeSchema> =
        safety.output.verdict === "UNSAFE"
          ? "BLOCK_UNSAFE"
          : safety.output.verdict === "NEEDS_REVIEW"
            ? "ESCALATE_TO_HUMAN"
            : "APPROVE_FOR_REVIEW";
      const nextStatus = safety.output.verdict === "UNSAFE" ? "BLOCKED" : "AWAITING_APPROVAL";

      await withWorkflowSpan(deps.tracer, { incidentId, correlationId, workflowName: "incident-response" }, async (span) => {
        recordDecisionOutcome(span, decisionOutcome);
      });

      await prisma.$transaction([
        prisma.incidentRecommendation.update({
          where: { id: recommendationId },
          data: {
            safetyVerdict: safety.output.verdict,
            safetyFlags: safety.output.flags as unknown as Prisma.InputJsonValue,
            decisionOutcome,
          },
        }),
        prisma.incident.update({ where: { id: incidentId }, data: { status: nextStatus } }),
        prisma.incidentEvent.create({
          data: {
            incidentId,
            type: "SAFETY_DECISION",
            actor: "agent:safety-validator",
            message: safety.output.rationale,
            metadata: { verdict: safety.output.verdict, flags: safety.output.flags, decisionOutcome, promptVersion: safety.promptVersion },
          },
        }),
      ]);

      if (safety.output.verdict === "UNSAFE") {
        await prisma.auditLog.create({
          data: {
            actorId: null,
            actorLabel: "system:safety-validator",
            action: "INCIDENT_AUTO_BLOCKED",
            entityType: "Incident",
            entityId: incidentId,
            metadata: { recommendationId, flags: safety.output.flags as unknown as Prisma.InputJsonValue },
          },
        });
      }

      return { incidentId, correlationId, safetyVerdict: safety.output.verdict, decisionOutcome };
    },
  });

  return createWorkflow({
    id: "incident-response",
    inputSchema: BaseIO,
    outputSchema: SafetyStepOutput,
  })
    .then(triageStep)
    .then(retrievalStep)
    .then(analysisStep)
    .then(safetyStep)
    .commit();
}
