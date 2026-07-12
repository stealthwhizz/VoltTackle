-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('DEPLOY_REGRESSION', 'INFRA_FAILURE', 'DEPENDENCY_OUTAGE', 'SUSPICIOUS_TRAFFIC');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'TRIAGING', 'RETRIEVING_CONTEXT', 'ANALYZING', 'AWAITING_APPROVAL', 'APPROVED', 'ESCALATED', 'BLOCKED', 'RESOLVED', 'POSTMORTEM_DRAFTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('APPROVE_FOR_REVIEW', 'ESCALATE_TO_HUMAN', 'BLOCK_UNSAFE');

-- CreateEnum
CREATE TYPE "RiskLabel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SafetyVerdict" AS ENUM ('SAFE', 'NEEDS_REVIEW', 'UNSAFE');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVE', 'ESCALATE', 'BLOCK');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ENGINEER', 'SENIOR_ENGINEER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PostmortemStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ENGINEER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'NEW',
    "category" "IncidentCategory",
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'SEV3',
    "description" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawAlert" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_events" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_recommendations" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "rootCauseHypothesis" TEXT NOT NULL,
    "rootCauseConfidence" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "actionSteps" JSONB NOT NULL,
    "riskLabel" "RiskLabel" NOT NULL,
    "rollbackGuidance" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "groundedReferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "safetyVerdict" "SafetyVerdict",
    "safetyFlags" JSONB NOT NULL DEFAULT '[]',
    "decisionOutcome" "DecisionOutcome",
    "promptVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postmortems" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "timeline" JSONB NOT NULL,
    "actionItems" JSONB NOT NULL,
    "status" "PostmortemStatus" NOT NULL DEFAULT 'DRAFT',
    "promptVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postmortems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runbook_sources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "service" TEXT,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qdrantPointId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runbook_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "service" TEXT,
    "docType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qdrantPointId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_correlationId_key" ON "incidents"("correlationId");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incidents_category_idx" ON "incidents"("category");

-- CreateIndex
CREATE INDEX "incidents_service_idx" ON "incidents"("service");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_source_externalId_key" ON "incidents"("source", "externalId");

-- CreateIndex
CREATE INDEX "incident_events_incidentId_idx" ON "incident_events"("incidentId");

-- CreateIndex
CREATE INDEX "incident_recommendations_incidentId_idx" ON "incident_recommendations"("incidentId");

-- CreateIndex
CREATE INDEX "approvals_incidentId_idx" ON "approvals"("incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "postmortems_incidentId_key" ON "postmortems"("incidentId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_agentName_versionId_key" ON "prompt_versions"("agentName", "versionId");

-- AddForeignKey
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_recommendations" ADD CONSTRAINT "incident_recommendations_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "incident_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postmortems" ADD CONSTRAINT "postmortems_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

