import { prisma } from "@volt-tackle/database";
import { buildIncidentWorkflow } from "./incidentWorkflow.js";
import type { WorkflowDeps } from "./types.js";

export type { WorkflowDeps } from "./types.js";
export { generatePostmortem } from "./postmortemGeneration.js";

export interface TriggerIncidentWorkflowInput {
  incidentId: string;
  correlationId: string;
}

/**
 * Runs the full triage -> retrieval -> analysis -> safety/decision-gate
 * pipeline to completion. Any failure inside a step (LLM exhausted retries,
 * unexpected error) is treated as a "fail safe" signal: the incident is
 * escalated to a human rather than left in a stuck or fabricated state.
 */
export async function triggerIncidentWorkflow(input: TriggerIncidentWorkflowInput, deps: WorkflowDeps): Promise<void> {
  const workflow = buildIncidentWorkflow(deps);
  const run = await workflow.createRun();

  let result;
  try {
    result = await run.start({ inputData: { incidentId: input.incidentId, correlationId: input.correlationId } });
  } catch (err) {
    await failSafeEscalate(input, deps, err);
    return;
  }

  if (result.status !== "success") {
    const error = result.status === "failed" ? result.error : new Error(`Workflow ended with status ${result.status}`);
    await failSafeEscalate(input, deps, error);
  }
}

async function failSafeEscalate(input: TriggerIncidentWorkflowInput, deps: WorkflowDeps, err: unknown): Promise<void> {
  deps.logger.error({ err, incidentId: input.incidentId }, "Incident workflow failed; escalating to human as a fail-safe.");

  await prisma.incident.update({ where: { id: input.incidentId }, data: { status: "ESCALATED" } });
  await prisma.incidentEvent.create({
    data: {
      incidentId: input.incidentId,
      type: "WORKFLOW_FAILED",
      actor: "system",
      message: `Automated incident pipeline failed and was escalated to a human: ${err instanceof Error ? err.message : String(err)}`,
      metadata: { correlationId: input.correlationId },
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: null,
      actorLabel: "system:workflow",
      action: "INCIDENT_AUTO_ESCALATED_ON_FAILURE",
      entityType: "Incident",
      entityId: input.incidentId,
      metadata: { correlationId: input.correlationId },
    },
  });
}
