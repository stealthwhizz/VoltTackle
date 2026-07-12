import type { PrismaClient } from "@prisma/client";

export const DOCUMENT_SEEDS = [
  {
    title: "Service Doc: checkout-api",
    service: "checkout-api",
    docType: "service-doc",
    tags: ["checkout-api", "architecture"],
    content:
      "checkout-api is a Node.js/Fastify service handling cart finalization and order creation. " +
      "It depends on payments-service (synchronous) and inventory-service (async via events). " +
      "Deploys go through GitHub Actions with canary rollout at 10% traffic for 10 minutes before full rollout. " +
      "Owned by the Commerce team. Typical failure modes: deploy regressions from schema migrations, connection pool exhaustion under load.",
  },
  {
    title: "Service Doc: payments-service",
    service: "payments-service",
    docType: "service-doc",
    tags: ["payments-service", "architecture"],
    content:
      "payments-service integrates with an external payment processor and a backup processor for failover. " +
      "It exposes a circuit breaker (payments.circuitBreaker) that trips automatically after 5 consecutive provider failures. " +
      "Owned by the Payments team. Typical failure modes: third-party provider outages, webhook signature validation failures after key rotation.",
  },
  {
    title: "Service Doc: auth-service",
    service: "auth-service",
    docType: "service-doc",
    tags: ["auth-service", "architecture"],
    content:
      "auth-service issues and validates JWTs for all internal services. It sits behind a WAF with rate limiting rules per IP/ASN. " +
      "Owned by the Platform Security team. Typical failure modes: credential stuffing / brute force spikes, suspicious traffic from scraper networks.",
  },
  {
    title: "Service Doc: platform-infra",
    service: "platform-infra",
    docType: "service-doc",
    tags: ["platform-infra", "architecture", "kubernetes"],
    content:
      "platform-infra covers the shared Kubernetes clusters, node autoscaling groups, and cluster-wide observability stack. " +
      "Owned by the Platform team. Typical failure modes: node memory/CPU pressure, autoscaler lag during traffic spikes.",
  },
];

export async function seedDocuments(prisma: PrismaClient) {
  const created = [];
  for (const doc of DOCUMENT_SEEDS) {
    const existing = await prisma.documentSource.findFirst({ where: { title: doc.title } });
    const record = existing
      ? await prisma.documentSource.update({ where: { id: existing.id }, data: doc })
      : await prisma.documentSource.create({ data: doc });
    created.push(record);
  }
  return created;
}
