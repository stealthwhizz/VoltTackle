import type { PrismaClient } from "@prisma/client";

export const RUNBOOK_SEEDS = [
  {
    title: "Runbook: Rolling Back a Bad Deploy",
    service: "checkout-api",
    tags: ["deploy-regression", "rollback", "ci-cd"],
    content:
      "When error rates spike within 15 minutes of a deploy: 1) Confirm the deploy window via the deployment provider. " +
      "2) Compare error-rate and latency dashboards before/after the deploy timestamp. " +
      "3) If regression is confirmed, trigger a rollback to the previous stable SHA using the deployment tool's rollback command. " +
      "4) Verify error rates return to baseline within 5 minutes. " +
      "5) Notify #incidents channel with rollback confirmation. Never force-push over the rollback commit.",
  },
  {
    title: "Runbook: Database Connection Pool Exhaustion",
    service: "checkout-api",
    tags: ["infra-failure", "database", "connection-pool"],
    content:
      "Symptoms: growing 'too many connections' errors, request timeouts. " +
      "1) Check current pool utilization via the DB metrics dashboard. " +
      "2) Identify long-running or leaked queries and terminate them if safe. " +
      "3) If pool size is misconfigured relative to instance count, scale down replicas or raise the pool ceiling within DB provider limits. " +
      "4) Restart the affected service pods one at a time (never all at once) to release stale connections. " +
      "5) Do not increase max_connections on the primary without DBA sign-off — risk of memory exhaustion.",
  },
  {
    title: "Runbook: Third-Party Payment Provider Outage",
    service: "payments-service",
    tags: ["dependency-outage", "third-party", "payments"],
    content:
      "1) Check the provider's public status page and API health endpoint. " +
      "2) If the provider is degraded, enable the circuit breaker to fail over to the backup processor. " +
      "3) Queue failed transactions for retry rather than dropping them. " +
      "4) Communicate customer-facing impact via the status page. " +
      "5) Do not disable payment validation as a workaround — this bypasses fraud checks.",
  },
  {
    title: "Runbook: Suspicious Traffic / Credential Stuffing",
    service: "auth-service",
    tags: ["suspicious-traffic", "security", "rate-limiting"],
    content:
      "Symptoms: spike in failed login attempts from a narrow IP range or ASN. " +
      "1) Pull the rate of 401s per IP/ASN over the last 30 minutes. " +
      "2) If concentrated, apply a temporary rate limit or WAF block rule scoped to the offending range. " +
      "3) Force-invalidate sessions only if account takeover is confirmed, not on suspicion alone. " +
      "4) Escalate to security on-call for anything beyond automated rate limiting. " +
      "5) Never disable authentication entirely as a mitigation.",
  },
  {
    title: "Runbook: Kubernetes Node Pressure and Pod Evictions",
    service: "platform-infra",
    tags: ["infra-failure", "kubernetes", "scaling"],
    content:
      "1) Check node memory/CPU pressure conditions via kubectl describe node. " +
      "2) Identify pods being evicted and whether they belong to a single noisy-neighbor deployment. " +
      "3) Scale the node pool horizontally if pressure is cluster-wide. " +
      "4) Apply resource requests/limits to any deployment missing them. " +
      "5) Avoid cordoning all nodes simultaneously — drain one at a time.",
  },
];

export async function seedRunbooks(prisma: PrismaClient) {
  const created = [];
  for (const runbook of RUNBOOK_SEEDS) {
    const existing = await prisma.runbookSource.findFirst({ where: { title: runbook.title } });
    const record = existing
      ? await prisma.runbookSource.update({ where: { id: existing.id }, data: runbook })
      : await prisma.runbookSource.create({ data: runbook });
    created.push(record);
  }
  return created;
}
