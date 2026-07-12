import type { Incident, Postmortem, RunbookSource, DocumentSource } from "@volt-tackle/database";
import type { RetrievalPayload } from "@volt-tackle/shared";
import type { MemoryPointInput } from "./upsert.js";

export function runbookToMemoryPoint(runbook: RunbookSource): MemoryPointInput {
  const payload: RetrievalPayload = {
    sourceType: "RUNBOOK",
    service: runbook.service,
    incidentCategory: null,
    severity: null,
    tags: runbook.tags,
    createdAt: runbook.createdAt.toISOString(),
    externalRef: `runbook:${runbook.title}`,
    title: runbook.title,
    snippet: truncate(runbook.content, 240),
  };
  return { id: runbook.id, embeddingText: `${runbook.title}\n${runbook.content}\n${runbook.tags.join(" ")}`, payload };
}

export function documentToMemoryPoint(doc: DocumentSource): MemoryPointInput {
  const payload: RetrievalPayload = {
    sourceType: "SERVICE_DOC",
    service: doc.service,
    incidentCategory: null,
    severity: null,
    tags: doc.tags,
    createdAt: doc.createdAt.toISOString(),
    externalRef: `doc:${doc.title}`,
    title: doc.title,
    snippet: truncate(doc.content, 240),
  };
  return { id: doc.id, embeddingText: `${doc.title}\n${doc.content}\n${doc.tags.join(" ")}`, payload };
}

export function incidentToMemoryPoint(incident: Incident): MemoryPointInput {
  const payload: RetrievalPayload = {
    sourceType: "INCIDENT",
    service: incident.service,
    incidentCategory: incident.category,
    severity: incident.severity,
    tags: incident.tags,
    createdAt: incident.createdAt.toISOString(),
    externalRef: `incident:${incident.title}`,
    title: incident.title,
    snippet: truncate(incident.description, 240),
  };
  return {
    id: incident.id,
    embeddingText: `${incident.title}\n${incident.description}\n${incident.tags.join(" ")}`,
    payload,
  };
}

export function postmortemToMemoryPoint(postmortem: Postmortem, incident: Incident): MemoryPointInput {
  const payload: RetrievalPayload = {
    sourceType: "POSTMORTEM",
    service: incident.service,
    incidentCategory: incident.category,
    severity: incident.severity,
    tags: incident.tags,
    createdAt: postmortem.createdAt.toISOString(),
    externalRef: `postmortem:${postmortem.title}`,
    title: postmortem.title,
    snippet: truncate(postmortem.summary, 240),
  };
  return {
    id: postmortem.id,
    embeddingText: `${postmortem.title}\n${postmortem.summary}\n${postmortem.rootCause}\n${postmortem.impact}`,
    payload,
  };
}

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}
