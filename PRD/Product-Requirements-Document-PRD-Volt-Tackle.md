# Product Requirements Document (PRD): Volt Tackle

## 1. Executive Summary
**Volt Tackle** is a production-grade AI engineering copilot designed specifically for startup engineering teams. It automates the end-to-end incident response lifecycle—from initial alert ingestion and triage to root cause analysis, safety-validated remediation, and automated postmortem generation. By leveraging a multi-agent orchestration layer, semantic long-term memory, and a dedicated safety evaluation tier, Volt Tackle transforms chaotic production incidents into structured, learning-oriented workflows.

## 2. Problem Statement
Startup engineering teams often lack mature SRE (Site Reliability Engineering) practices. On-call engineers are frequently overwhelmed by:
*   **Context Switching:** Manually digging through logs, metrics, and deployment history during high-pressure incidents.
*   **Knowledge Silos:** Difficulty retrieving relevant past incidents or runbooks.
*   **High-Risk Remediation:** The danger of applying "cowboy" fixes or hallucinated AI suggestions that could worsen an outage.
*   **Documentation Debt:** Postmortems are often skipped or poorly written due to time constraints.

## 3. Goals & Objectives
*   **Reduce MTTR (Mean Time to Resolution):** Accelerate investigation by automatically correlating logs, metrics, and deployment metadata.
*   **Ensure Operational Safety:** Implement a mandatory safety gate to block destructive or hallucinated remediation steps.
*   **Automate Knowledge Retention:** Create a self-improving "Learning Loop" where every incident improves the system's future retrieval capabilities.
*   **Human-in-the-Loop (HITL):** Provide a clear interface for engineers to approve, escalate, or block AI-suggested actions.

## 4. Target Users / Stakeholders
*   **On-call Full-stack/Backend Engineers:** Primary users responding to active incidents.
*   **DevOps/SRE Engineers:** Responsible for maintaining the incident response infrastructure and runbooks.
*   **Engineering Managers:** Stakeholders interested in postmortem quality and systemic reliability trends.

## 5. Functional Requirements

### 5.1 Incident Ingestion & Triage
*   **Alert Ingestion:** Support high-volume alert webhooks from Datadog and Prometheus via an asynchronous Kafka event stream.
*   **Classification:** The **Incident Triage Agent** must categorize incidents into one of four specific buckets:
    1.  Deploy Regression
    2.  Infra Failure
    3.  Dependency Outage
    4.  Suspicious Traffic (Anomalies)

### 5.2 Contextual Retrieval
*   **Semantic Search:** The **Memory & Runbook Retrieval Agent** must query **Qdrant** for semantically similar past incidents, existing runbooks, and service documentation.
*   **Data Grounding:** All reasoning must be grounded in retrieved context rather than pure LLM generation.

### 5.3 Analysis & Remediation
*   **Root Cause Analysis (RCA):** The **Root Cause Agent** must correlate logs, metrics, and deployment metadata (GitHub/GitLab) to identify the likely culprit.
*   **Remediation Proposals:** The **Remediation Agent** must generate specific action steps (e.g., rollback, scale-up) accompanied by **Risk Labels**.

### 5.4 Safety & Approval Workflow
*   **Safety Validation:** Every remediation suggestion must be scanned by the **Safety Validator Agent** using **Enkrypt AI** to detect hallucinations or destructive commands.
*   **Decision Gate:** A logic gate must offer three distinct paths:
    *   **Approve Action:** Execute fix via Deployment Tools.
    *   **Escalate to Human:** Pause for manual intervention via the UI.
    *   **Block Unsafe:** Hard stop for suggestions flagged as dangerous.

### 5.5 Postmortem & Learning
*   **Automated Drafting:** The **Postmortem Agent** must generate a blameless report including timeline, impact, root cause, and follow-up actions.
*   **Learning Loop:** Finalized postmortems and updated runbooks must be automatically indexed back into **Qdrant**.

## 6. Non-Functional Requirements
*   **Performance:** The system must handle "alert storms" using Kafka to prevent orchestrator bottlenecks.
*   **Reliability:** Workflow state must be persisted in Postgres to allow recovery from service restarts.
*   **Scalability:** Modular agent architecture to allow for adding specialized agents in the future.
*   **Safety:** 100% of remediation suggestions must pass through Enkrypt AI before being presented to a user or executed.

## 7. System Architecture Overview
The system follows a layered multi-agent architecture:
1.  **Client Layer:** React/Next.js dashboard for human interaction.
2.  **Orchestration Layer:** Mastra-managed state machine handling HITL branching and agent dispatching.
3.  **AI Agent Fleet:** Specialized agents for Triage, Retrieval, RCA, Remediation, Safety, and Postmortems.
4.  **Persistence Layer:** Postgres for structured state/metadata; Qdrant for unstructured semantic memory.
5.  **External Layer:** Integrations with Monitoring (Datadog), Deployment (GitHub), and Safety (Enkrypt AI) platforms.

## 8. Tech Stack
*   **Orchestration:** Mastra (TypeScript)
*   **Frontend:** React, Next.js, Tailwind CSS, TypeScript
*   **Backend/API:** Fastify, TypeScript, Zod
*   **Vector Database:** Qdrant
*   **Relational Database:** PostgreSQL (with Prisma ORM)
*   **Message Broker:** Kafka / Redpanda
*   **Safety Layer:** Enkrypt AI SDK
*   **LLMs:** OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet)
*   **Observability:** OpenTelemetry, Prometheus, Grafana

## 9. Data Requirements
*   **Qdrant Schema:** Must store vector embeddings for:
    *   Past Incident Reports
    *   Technical Runbooks
    *   Service Documentation
    *   Finalized Postmortems
*   **Postgres Schema:** Must track:
    *   Incident Metadata (ID, Status, Category, Severity)
    *   Mastra Workflow State (Step-by-step execution history)
    *   User Sessions and Audit Logs (Who approved what action)

## 10. API Specifications
*   **POST `/webhooks/alerts`:** Ingests raw alerts from external monitoring tools.
*   **GET `/incidents`:** Lists active and historical incidents.
*   **POST `/incidents/:id/approve`:** User approval for a remediation action.
*   **POST `/incidents/:id/escalate`:** Manual override to bypass automated flow.
*   **GET `/incidents/:id/postmortem`:** Retrieves the AI-generated draft for review.

## 11. Security Requirements
*   **Authentication:** Secure access to the Volt Tackle UI for engineering staff.
*   **Authorization:** Role-based access for "Approve" actions (e.g., Senior Engineers only for high-risk fixes).
*   **Data Protection:** Enkrypt AI must scan for sensitive data leaks (PII/Secrets) in agent outputs.
*   **Audit Trail:** Every action taken by an agent or human must be logged in Postgres.

## 12. Deployment & Infrastructure
*   **Cloud Provider:** AWS (as per architecture diagram).
*   **Containerization:** Services should be containerized for consistent deployment.
*   **CI/CD:** Integration with GitHub Actions or GitLab CI for automated testing and deployment.

## 13. Success Metrics
*   **MTTR Reduction:** Target 30-50% reduction in time to resolve common incident types.
*   **Safety Rate:** 0% execution of "Blocked" or "Unsafe" commands.
*   **Knowledge Capture:** 100% of resolved incidents result in a drafted postmortem.
*   **Retrieval Accuracy:** Percentage of incidents where the "Memory Agent" finds a relevant past solution.

## 14. Timeline & Milestones
*   **Phase 1 (MVP):** Kafka ingestion, Mastra orchestration, Triage Agent, and Qdrant retrieval.
*   **Phase 2 (Safety & Remediation):** Integration of Enkrypt AI, Remediation Agent, and the HITL Decision Gate.
*   **Phase 3 (Learning Loop):** Postmortem Agent automation and the feedback loop to Qdrant.
*   **Phase 4 (Scale):** Observability Agent implementation and full dashboard polish.

## 15. Open Questions & Risks
*   **LLM Latency:** Will the multi-agent chain be fast enough for real-time incident response?
*   **Integration Complexity:** Variability in log formats across different startup stacks.
*   **Risk Scoring Accuracy:** Ensuring the Remediation Agent's "Risk Labels" align with actual production impact.