import type {
  Incident,
  IncidentEvent,
  IncidentRecommendation,
  Approval,
  Postmortem,
  User,
} from "@volt-tackle/database";
import type {
  ApprovalDto,
  IncidentDetailDto,
  IncidentDto,
  IncidentEventDto,
  IncidentRecommendationDto,
  PostmortemDto,
} from "@volt-tackle/shared";

export function toIncidentDto(incident: Incident): IncidentDto {
  return {
    id: incident.id,
    correlationId: incident.correlationId,
    title: incident.title,
    service: incident.service,
    source: incident.source,
    externalId: incident.externalId,
    status: incident.status,
    category: incident.category,
    severity: incident.severity,
    description: incident.description,
    tags: incident.tags,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
    resolvedAt: incident.resolvedAt ? incident.resolvedAt.toISOString() : null,
  };
}

export function toIncidentEventDto(event: IncidentEvent): IncidentEventDto {
  return {
    id: event.id,
    incidentId: event.incidentId,
    type: event.type,
    actor: event.actor,
    message: event.message,
    metadata: (event.metadata as Record<string, unknown> | null) ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

export function toRecommendationDto(rec: IncidentRecommendation): IncidentRecommendationDto {
  return {
    id: rec.id,
    incidentId: rec.incidentId,
    rootCauseHypothesis: rec.rootCauseHypothesis,
    rootCauseConfidence: rec.rootCauseConfidence,
    summary: rec.summary,
    actionSteps: rec.actionSteps as IncidentRecommendationDto["actionSteps"],
    riskLabel: rec.riskLabel,
    rollbackGuidance: rec.rollbackGuidance,
    confidenceScore: rec.confidenceScore,
    groundedReferences: rec.groundedReferences,
    safetyVerdict: rec.safetyVerdict,
    safetyFlags: rec.safetyFlags as Record<string, unknown>[],
    decisionOutcome: rec.decisionOutcome,
    promptVersion: rec.promptVersion,
    createdAt: rec.createdAt.toISOString(),
  };
}

export function toApprovalDto(approval: Approval & { actor: User }): ApprovalDto {
  return {
    id: approval.id,
    incidentId: approval.incidentId,
    recommendationId: approval.recommendationId,
    action: approval.action,
    actorId: approval.actorId,
    actorName: approval.actor.name,
    reason: approval.reason,
    createdAt: approval.createdAt.toISOString(),
  };
}

export function toPostmortemDto(pm: Postmortem): PostmortemDto {
  return {
    id: pm.id,
    incidentId: pm.incidentId,
    title: pm.title,
    summary: pm.summary,
    impact: pm.impact,
    rootCause: pm.rootCause,
    timeline: pm.timeline as PostmortemDto["timeline"],
    actionItems: pm.actionItems as PostmortemDto["actionItems"],
    status: pm.status,
    promptVersion: pm.promptVersion,
    createdAt: pm.createdAt.toISOString(),
    updatedAt: pm.updatedAt.toISOString(),
  };
}

export function toIncidentDetailDto(incident: Incident & {
  events: IncidentEvent[];
  recommendations: IncidentRecommendation[];
  approvals: (Approval & { actor: User })[];
  postmortem: Postmortem | null;
}): IncidentDetailDto {
  return {
    ...toIncidentDto(incident),
    events: incident.events.map(toIncidentEventDto),
    recommendations: incident.recommendations.map(toRecommendationDto),
    approvals: incident.approvals.map(toApprovalDto),
    postmortem: incident.postmortem ? toPostmortemDto(incident.postmortem) : null,
  };
}
