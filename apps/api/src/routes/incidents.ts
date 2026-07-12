import type { FastifyInstance } from "fastify";
import {
  ApprovalActionInputSchema,
  IncidentIdParamSchema,
  ListIncidentsQuerySchema,
} from "@volt-tackle/shared";
import { prisma } from "@volt-tackle/database";
import { generatePostmortem } from "@volt-tackle/workflows";
import { toIncidentDetailDto, toIncidentDto, toPostmortemDto } from "../lib/dto.js";
import { recordAuditLog } from "../lib/auditLog.js";

const INCIDENT_DETAIL_INCLUDE = {
  events: { orderBy: { createdAt: "asc" as const } },
  recommendations: { orderBy: { createdAt: "asc" as const } },
  approvals: { include: { actor: true }, orderBy: { createdAt: "asc" as const } },
  postmortem: true,
};

export default async function incidentRoutes(fastify: FastifyInstance) {
  fastify.get("/api/incidents", async (request, reply) => {
    const parsed = ListIncidentsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "ValidationError", issues: parsed.error.issues });
    }
    const { status, category, service, limit, offset } = parsed.data;

    const incidents = await prisma.incident.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(service ? { service } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.incident.count({
      where: {
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(service ? { service } : {}),
      },
    });

    return reply.send({ incidents: incidents.map(toIncidentDto), total, limit, offset });
  });

  fastify.get("/api/incidents/:id", async (request, reply) => {
    const params = IncidentIdParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "ValidationError", issues: params.error.issues });

    const incident = await prisma.incident.findUnique({
      where: { id: params.data.id },
      include: INCIDENT_DETAIL_INCLUDE,
    });
    if (!incident) return reply.code(404).send({ error: "NotFound", message: "Incident not found." });

    return reply.send(toIncidentDetailDto(incident));
  });

  fastify.get("/api/incidents/:id/postmortem", async (request, reply) => {
    const params = IncidentIdParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "ValidationError", issues: params.error.issues });

    const postmortem = await prisma.postmortem.findUnique({ where: { incidentId: params.data.id } });
    if (!postmortem) return reply.code(404).send({ error: "NotFound", message: "No postmortem for this incident yet." });

    return reply.send(toPostmortemDto(postmortem));
  });

  fastify.post(
    "/api/incidents/:id/approve",
    { preHandler: fastify.authenticate, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = IncidentIdParamSchema.safeParse(request.params);
      const body = ApprovalActionInputSchema.safeParse(request.body);
      if (!params.success) return reply.code(400).send({ error: "ValidationError", issues: params.error.issues });
      if (!body.success) return reply.code(400).send({ error: "ValidationError", issues: body.error.issues });

      const incident = await prisma.incident.findUnique({ where: { id: params.data.id } });
      if (!incident) return reply.code(404).send({ error: "NotFound", message: "Incident not found." });

      const recommendation = await prisma.incidentRecommendation.findUnique({
        where: { id: body.data.recommendationId },
      });
      if (!recommendation || recommendation.incidentId !== incident.id) {
        return reply.code(404).send({ error: "NotFound", message: "Recommendation not found for this incident." });
      }

      if (incident.status !== "AWAITING_APPROVAL") {
        return reply.code(409).send({ error: "InvalidState", message: `Incident is in status ${incident.status}, not awaiting approval.` });
      }

      if (recommendation.safetyVerdict === "UNSAFE") {
        return reply.code(403).send({
          error: "SafetyBlocked",
          message: "This remediation was flagged UNSAFE by the safety validator and cannot be approved.",
        });
      }

      const isHighRisk = recommendation.riskLabel === "HIGH" || recommendation.riskLabel === "CRITICAL";
      if (isHighRisk && !["SENIOR_ENGINEER", "ADMIN"].includes(request.user.role)) {
        return reply.code(403).send({
          error: "Forbidden",
          message: "High-risk remediations require a senior engineer or admin to approve.",
        });
      }

      const now = new Date();
      await prisma.$transaction([
        prisma.approval.create({
          data: {
            incidentId: incident.id,
            recommendationId: recommendation.id,
            action: "APPROVE",
            actorId: request.user.sub,
            reason: body.data.reason ?? null,
          },
        }),
        prisma.incident.update({
          where: { id: incident.id },
          data: { status: "RESOLVED", resolvedAt: now },
        }),
        prisma.incidentEvent.create({
          data: {
            incidentId: incident.id,
            type: "APPROVAL_DECISION",
            actor: request.user.email,
            message: `Remediation approved by ${request.user.email}; incident marked resolved.`,
            metadata: { recommendationId: recommendation.id, reason: body.data.reason ?? null },
          },
        }),
      ]);

      await recordAuditLog({
        actorId: request.user.sub,
        actorLabel: request.user.email,
        action: "INCIDENT_APPROVED",
        entityType: "Incident",
        entityId: incident.id,
        metadata: { recommendationId: recommendation.id, reason: body.data.reason ?? null },
      });

      generatePostmortem({ incidentId: incident.id, correlationId: incident.correlationId }, fastify.ctx).catch((err) => {
        fastify.ctx.logger.error({ err, incidentId: incident.id }, "Postmortem generation failed after approval.");
      });

      const updated = await prisma.incident.findUniqueOrThrow({ where: { id: incident.id }, include: INCIDENT_DETAIL_INCLUDE });
      return reply.send(toIncidentDetailDto(updated));
    },
  );

  fastify.post(
    "/api/incidents/:id/escalate",
    { preHandler: fastify.authenticate, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = await applyDecision(fastify, request, reply, "ESCALATE", "ESCALATED");
      return result;
    },
  );

  fastify.post(
    "/api/incidents/:id/block",
    { preHandler: fastify.authenticate, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = await applyDecision(fastify, request, reply, "BLOCK", "BLOCKED");
      return result;
    },
  );
}

async function applyDecision(
  fastify: FastifyInstance,
  request: Parameters<FastifyInstance["authenticate"]>[0],
  reply: Parameters<FastifyInstance["authenticate"]>[1],
  action: "ESCALATE" | "BLOCK",
  nextStatus: "ESCALATED" | "BLOCKED",
) {
  const params = IncidentIdParamSchema.safeParse(request.params);
  const body = ApprovalActionInputSchema.safeParse(request.body);
  if (!params.success) return reply.code(400).send({ error: "ValidationError", issues: params.error.issues });
  if (!body.success) return reply.code(400).send({ error: "ValidationError", issues: body.error.issues });

  const incident = await prisma.incident.findUnique({ where: { id: params.data.id } });
  if (!incident) return reply.code(404).send({ error: "NotFound", message: "Incident not found." });

  const recommendation = await prisma.incidentRecommendation.findUnique({
    where: { id: body.data.recommendationId },
  });
  if (!recommendation || recommendation.incidentId !== incident.id) {
    return reply.code(404).send({ error: "NotFound", message: "Recommendation not found for this incident." });
  }

  if (!["AWAITING_APPROVAL", "ESCALATED"].includes(incident.status)) {
    return reply.code(409).send({ error: "InvalidState", message: `Incident is in status ${incident.status}.` });
  }

  await prisma.$transaction([
    prisma.approval.create({
      data: {
        incidentId: incident.id,
        recommendationId: recommendation.id,
        action,
        actorId: request.user.sub,
        reason: body.data.reason ?? null,
      },
    }),
    prisma.incident.update({ where: { id: incident.id }, data: { status: nextStatus } }),
    prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: "APPROVAL_DECISION",
        actor: request.user.email,
        message: `Remediation ${action.toLowerCase()}d by ${request.user.email}.`,
        metadata: { recommendationId: recommendation.id, reason: body.data.reason ?? null },
      },
    }),
  ]);

  await recordAuditLog({
    actorId: request.user.sub,
    actorLabel: request.user.email,
    action: `INCIDENT_${action}D`,
    entityType: "Incident",
    entityId: incident.id,
    metadata: { recommendationId: recommendation.id, reason: body.data.reason ?? null },
  });

  const updated = await prisma.incident.findUniqueOrThrow({ where: { id: incident.id }, include: INCIDENT_DETAIL_INCLUDE });
  return reply.send(toIncidentDetailDto(updated));
}
