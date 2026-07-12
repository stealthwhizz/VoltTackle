import type { PrismaClient } from "@prisma/client";

/**
 * Historical, already-resolved incidents with finalized postmortems.
 * These exist so the Retrieval Agent has real semantic-memory content to
 * find when a new, similar incident comes in — see packages/retrieval bootstrap.
 */
const HISTORICAL_INCIDENTS = [
  {
    incident: {
      title: "Checkout error rate spike after v2.14.0 deploy",
      service: "checkout-api",
      source: "datadog",
      externalId: "hist-seed-checkout-deploy-1",
      status: "CLOSED" as const,
      category: "DEPLOY_REGRESSION" as const,
      severity: "SEV2" as const,
      description:
        "5xx error rate on POST /checkout/complete jumped from 0.2% to 14% within 6 minutes of deploying v2.14.0.",
      tags: ["checkout-api", "5xx", "deploy"],
    },
    recommendation: {
      rootCauseHypothesis:
        "The v2.14.0 deploy introduced a schema migration that dropped a column still read by the previous checkout-api revision during the canary window, causing serialization errors.",
      rootCauseConfidence: 0.86,
      summary: "Roll back checkout-api to the last stable SHA and re-run the migration with a backward-compatible expand/contract pattern.",
      actionSteps: [
        { order: 1, description: "Roll back checkout-api deployment to previous stable SHA." },
        { order: 2, description: "Verify 5xx rate returns to baseline within 5 minutes." },
        { order: 3, description: "Re-plan the column drop using expand/contract migration pattern." },
      ],
      riskLabel: "MEDIUM" as const,
      rollbackGuidance: "Standard deployment rollback via CI/CD to the previous stable SHA; no data migration rollback required.",
      confidenceScore: 0.82,
      groundedReferences: ["runbook:Runbook: Rolling Back a Bad Deploy"],
      safetyVerdict: "SAFE" as const,
      safetyFlags: [],
      decisionOutcome: "APPROVE_FOR_REVIEW" as const,
      promptVersion: "remediation-agent@v1",
    },
    postmortem: {
      title: "Postmortem: Checkout error rate spike after v2.14.0 deploy",
      summary:
        "A schema migration in v2.14.0 dropped a column still referenced by in-flight canary pods, causing a 14% error rate on checkout completion for 11 minutes.",
      impact: "Approximately 380 failed checkout attempts over 11 minutes before rollback completed.",
      rootCause:
        "Migration dropped `checkout_orders.legacy_promo_code` in the same deploy that removed code references, without a compatibility window for the canary revision still running the old binary.",
      timeline: [
        { timestamp: "2026-05-12T14:02:00.000Z", label: "v2.14.0 deploy started" },
        { timestamp: "2026-05-12T14:05:00.000Z", label: "5xx error rate crosses 10% threshold, alert fires" },
        { timestamp: "2026-05-12T14:09:00.000Z", label: "On-call confirms deploy regression via triage" },
        { timestamp: "2026-05-12T14:13:00.000Z", label: "Rollback to previous stable SHA completed" },
        { timestamp: "2026-05-12T14:18:00.000Z", label: "Error rate confirmed back at baseline" },
      ],
      actionItems: [
        { description: "Adopt expand/contract migration pattern for all column drops.", owner: "Commerce team" },
        { description: "Add a canary-aware schema compatibility check to CI.", owner: "Platform team" },
      ],
      status: "FINALIZED" as const,
      promptVersion: "postmortem-agent@v1",
    },
  },
  {
    incident: {
      title: "Payments provider timeout cascade",
      service: "payments-service",
      source: "datadog",
      externalId: "hist-seed-payments-outage-1",
      status: "CLOSED" as const,
      category: "DEPENDENCY_OUTAGE" as const,
      severity: "SEV1" as const,
      description:
        "Primary payment processor started timing out on ~40% of authorize requests, causing checkout timeouts to cascade.",
      tags: ["payments-service", "third-party", "timeout"],
    },
    recommendation: {
      rootCauseHypothesis:
        "The primary payment processor experienced a regional outage; payments-service's circuit breaker threshold was too high to fail over quickly.",
      rootCauseConfidence: 0.9,
      summary: "Manually trip the circuit breaker to fail over to the backup processor and queue retries for failed authorizations.",
      actionSteps: [
        { order: 1, description: "Manually trip payments.circuitBreaker to route to backup processor." },
        { order: 2, description: "Queue failed authorize requests for automatic retry." },
        { order: 3, description: "Monitor backup processor success rate for 15 minutes." },
      ],
      riskLabel: "MEDIUM" as const,
      rollbackGuidance: "Reset circuit breaker to automatic mode once the primary processor's status page reports recovery.",
      confidenceScore: 0.88,
      groundedReferences: ["runbook:Runbook: Third-Party Payment Provider Outage"],
      safetyVerdict: "SAFE" as const,
      safetyFlags: [],
      decisionOutcome: "APPROVE_FOR_REVIEW" as const,
      promptVersion: "remediation-agent@v1",
    },
    postmortem: {
      title: "Postmortem: Payments provider timeout cascade",
      summary:
        "A regional outage at our primary payment processor caused a 40% authorize failure rate; the circuit breaker's default threshold delayed failover by several minutes.",
      impact: "Roughly 22 minutes of degraded checkout success rate, an estimated 640 affected checkout attempts.",
      rootCause: "Primary payment processor regional outage combined with an overly conservative circuit breaker threshold.",
      timeline: [
        { timestamp: "2026-06-02T09:14:00.000Z", label: "Processor authorize latency spikes, alert fires" },
        { timestamp: "2026-06-02T09:19:00.000Z", label: "On-call manually trips circuit breaker to backup processor" },
        { timestamp: "2026-06-02T09:22:00.000Z", label: "Checkout success rate recovers" },
        { timestamp: "2026-06-02T09:36:00.000Z", label: "Primary processor status page confirms recovery" },
      ],
      actionItems: [
        { description: "Lower circuit breaker failure threshold from 5 to 3 consecutive failures.", owner: "Payments team" },
        { description: "Add automatic failover instead of requiring manual trip.", owner: "Payments team" },
      ],
      status: "FINALIZED" as const,
      promptVersion: "postmortem-agent@v1",
    },
  },
];

export async function seedHistoricalIncidents(prisma: PrismaClient) {
  const created = [];
  for (const entry of HISTORICAL_INCIDENTS) {
    const existing = await prisma.incident.findUnique({
      where: { source_externalId: { source: entry.incident.source, externalId: entry.incident.externalId } },
    });

    const incident = existing
      ? existing
      : await prisma.incident.create({
          data: { ...entry.incident, resolvedAt: new Date() },
        });

    const recommendation = await prisma.incidentRecommendation.findFirst({ where: { incidentId: incident.id } });
    const rec =
      recommendation ??
      (await prisma.incidentRecommendation.create({
        data: { ...entry.recommendation, incidentId: incident.id },
      }));

    const postmortem = await prisma.postmortem.findUnique({ where: { incidentId: incident.id } });
    if (!postmortem) {
      await prisma.postmortem.create({ data: { ...entry.postmortem, incidentId: incident.id } });
    }

    created.push({ incident, recommendation: rec });
  }
  return created;
}
