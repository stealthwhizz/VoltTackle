import { prisma, Prisma } from "@volt-tackle/database";
import { runPostmortemAgent } from "@volt-tackle/agents";
import { upsertMemoryPoint, postmortemToMemoryPoint } from "@volt-tackle/retrieval";
import type { WorkflowDeps } from "./types.js";

export interface GeneratePostmortemInput {
  incidentId: string;
  correlationId: string;
}

/**
 * A single-step operation, not a multi-agent pipeline, so it's a plain
 * function rather than a Mastra workflow — see docs/adr for why we don't
 * force every agent invocation through the workflow engine.
 */
export async function generatePostmortem(input: GeneratePostmortemInput, deps: WorkflowDeps): Promise<void> {
  const { incidentId, correlationId } = input;

  const incident = await prisma.incident.findUniqueOrThrow({
    where: { id: incidentId },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      recommendations: { orderBy: { createdAt: "desc" }, take: 1 },
      approvals: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const recommendation = incident.recommendations[0];
  const approval = incident.approvals[0];
  if (!recommendation) {
    deps.logger.warn({ incidentId }, "No recommendation found; skipping postmortem generation.");
    return;
  }

  const timelineEvents = incident.events.map((e) => ({ timestamp: e.createdAt.toISOString(), label: e.message }));

  const { output, promptVersion } = await runPostmortemAgent(
    {
      incidentSummary: incident.description,
      category: incident.category ?? "INFRA_FAILURE",
      rootCauseHypothesis: recommendation.rootCauseHypothesis,
      remediationSummary: recommendation.summary,
      actionStepsTaken: (recommendation.actionSteps as Array<{ description: string }>).map((s) => s.description),
      decisionOutcome: approval?.action ?? recommendation.decisionOutcome ?? "APPROVE_FOR_REVIEW",
      timelineEvents,
    },
    deps,
    { incidentId, correlationId },
  );

  const postmortem = await prisma.postmortem.upsert({
    where: { incidentId },
    update: {
      title: output.title,
      summary: output.summary,
      impact: output.impact,
      rootCause: output.rootCause,
      timeline: output.timeline as unknown as Prisma.InputJsonValue,
      actionItems: output.actionItems as unknown as Prisma.InputJsonValue,
      status: "FINALIZED",
      promptVersion,
    },
    create: {
      incidentId,
      title: output.title,
      summary: output.summary,
      impact: output.impact,
      rootCause: output.rootCause,
      timeline: output.timeline as unknown as Prisma.InputJsonValue,
      actionItems: output.actionItems as unknown as Prisma.InputJsonValue,
      status: "FINALIZED",
      promptVersion,
    },
  });

  await prisma.incident.update({ where: { id: incidentId }, data: { status: "POSTMORTEM_DRAFTED" } });

  await prisma.incidentEvent.create({
    data: {
      incidentId,
      type: "POSTMORTEM_GENERATED",
      actor: "agent:postmortem-agent",
      message: `Postmortem "${output.title}" generated and finalized.`,
      metadata: { promptVersion },
    },
  });

  // Learning Loop: index the finalized postmortem back into Qdrant so future
  // incidents can retrieve it as grounded context.
  const point = postmortemToMemoryPoint(postmortem, incident);
  await upsertMemoryPoint(deps.qdrantClient, deps.embeddingsProvider, point);

  deps.logger.info({ incidentId, postmortemId: postmortem.id }, "Postmortem generated and indexed into Qdrant.");
}
