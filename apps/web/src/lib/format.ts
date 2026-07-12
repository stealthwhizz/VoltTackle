import type {
  DecisionOutcome,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  RiskLabel,
  SafetyVerdict,
} from "@volt-tackle/shared";

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  DEPLOY_REGRESSION: "Deploy Regression",
  INFRA_FAILURE: "Infra Failure",
  DEPENDENCY_OUTAGE: "Dependency Outage",
  SUSPICIOUS_TRAFFIC: "Suspicious Traffic",
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  NEW: "New",
  TRIAGING: "Triaging",
  RETRIEVING_CONTEXT: "Retrieving Context",
  ANALYZING: "Analyzing",
  AWAITING_APPROVAL: "Awaiting Approval",
  APPROVED: "Approved",
  ESCALATED: "Escalated",
  BLOCKED: "Blocked",
  RESOLVED: "Resolved",
  POSTMORTEM_DRAFTED: "Postmortem Drafted",
  CLOSED: "Closed",
};

export const DECISION_LABELS: Record<DecisionOutcome, string> = {
  APPROVE_FOR_REVIEW: "Approve for Review",
  ESCALATE_TO_HUMAN: "Escalate to Human",
  BLOCK_UNSAFE: "Block Unsafe",
};

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "critical";

export const SEVERITY_TONE: Record<IncidentSeverity, Tone> = {
  SEV1: "critical",
  SEV2: "danger",
  SEV3: "warning",
  SEV4: "neutral",
};

export const STATUS_TONE: Record<IncidentStatus, Tone> = {
  NEW: "neutral",
  TRIAGING: "info",
  RETRIEVING_CONTEXT: "info",
  ANALYZING: "info",
  AWAITING_APPROVAL: "warning",
  APPROVED: "success",
  ESCALATED: "warning",
  BLOCKED: "critical",
  RESOLVED: "success",
  POSTMORTEM_DRAFTED: "success",
  CLOSED: "neutral",
};

export const RISK_TONE: Record<RiskLabel, Tone> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "critical",
};

export const SAFETY_TONE: Record<SafetyVerdict, Tone> = {
  SAFE: "success",
  NEEDS_REVIEW: "warning",
  UNSAFE: "critical",
};

export const DECISION_TONE: Record<DecisionOutcome, Tone> = {
  APPROVE_FOR_REVIEW: "success",
  ESCALATE_TO_HUMAN: "warning",
  BLOCK_UNSAFE: "critical",
};

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-night-800 text-slate-300 ring-1 ring-inset ring-white/10",
  info: "bg-volt/10 text-volt-200 ring-1 ring-inset ring-volt/30",
  success: "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  danger: "bg-orange-500/10 text-orange-300 ring-1 ring-inset ring-orange-500/30",
  critical: "bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/30",
};
