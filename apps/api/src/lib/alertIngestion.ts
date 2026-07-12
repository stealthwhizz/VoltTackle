import { prisma, Prisma } from "@volt-tackle/database";
import type { AlertWebhookPayload } from "@volt-tackle/shared";
import { triggerIncidentWorkflow } from "@volt-tackle/workflows";
import type { AppContext } from "../context.js";

export interface IngestAlertResult {
  incidentId: string;
  correlationId: string;
  created: boolean;
}

/**
 * Idempotently turns a normalized alert payload into an Incident row and
 * kicks off the workflow. Idempotency (keyed on source+externalId) matters
 * because monitoring tools frequently redeliver the same alert during a
 * storm — we must not spawn duplicate workflow runs for the same event.
 */
export async function ingestAlert(
  payload: AlertWebhookPayload,
  ctx: AppContext,
  correlationId?: string,
): Promise<IngestAlertResult> {
  const { logger } = ctx;
  const existing = await prisma.incident.findUnique({
    where: { source_externalId: { source: payload.source, externalId: payload.externalId } },
  });

  if (existing) {
    logger.info({ incidentId: existing.id, externalId: payload.externalId }, "Duplicate alert ignored (idempotent).");
    return { incidentId: existing.id, correlationId: existing.correlationId, created: false };
  }

  const incident = await prisma.incident.create({
    data: {
      ...(correlationId ? { correlationId } : {}),
      title: `${payload.alertName} — ${payload.service}`,
      service: payload.service,
      source: payload.source,
      externalId: payload.externalId,
      severity: payload.severity,
      description: payload.message,
      tags: payload.tags,
      rawAlert: (payload.raw ?? payload) as Prisma.InputJsonValue,
    },
  });

  await prisma.incidentEvent.create({
    data: {
      incidentId: incident.id,
      type: "ALERT_RECEIVED",
      actor: `monitoring:${payload.source}`,
      message: `Alert "${payload.alertName}" received for service "${payload.service}".`,
      metadata: { severity: payload.severity, tags: payload.tags },
    },
  });

  logger.info({ incidentId: incident.id, correlationId: incident.correlationId }, "Incident created from alert.");

  await triggerIncidentWorkflow({ incidentId: incident.id, correlationId: incident.correlationId }, ctx);

  return { incidentId: incident.id, correlationId: incident.correlationId, created: true };
}
