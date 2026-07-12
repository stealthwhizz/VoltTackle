"use client";

import { useState } from "react";
import type { IncidentDetailDto, IncidentRecommendationDto } from "@volt-tackle/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/components/LoginGate";
import { Badge } from "@/components/Badge";
import { RISK_TONE, SAFETY_TONE, DECISION_TONE, DECISION_LABELS } from "@/lib/format";

interface Props {
  incident: IncidentDetailDto;
  recommendation: IncidentRecommendationDto;
  onChange: (updated: IncidentDetailDto) => void;
}

type SafetyFlag = { type?: string; severity?: string; detail?: string };

export function RecommendationPanel({ incident, recommendation, onChange }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isActionable = incident.status === "AWAITING_APPROVAL" || incident.status === "ESCALATED";
  const isBlocked = recommendation.safetyVerdict === "UNSAFE";
  const isHighRisk = recommendation.riskLabel === "HIGH" || recommendation.riskLabel === "CRITICAL";
  const canApproveHighRisk = user?.role === "SENIOR_ENGINEER" || user?.role === "ADMIN";

  async function act(kind: "approve" | "escalate" | "block") {
    setBusy(kind);
    setError(null);
    try {
      const fn = kind === "approve" ? api.approve : kind === "escalate" ? api.escalate : api.block;
      const updated = await fn(incident.id, recommendation.id, reason || undefined);
      onChange(updated);
      setReason("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const flags = (recommendation.safetyFlags as SafetyFlag[]) ?? [];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">AI Remediation Recommendation</h2>
        <div className="flex flex-wrap gap-2">
          <Badge tone={RISK_TONE[recommendation.riskLabel]}>Risk: {recommendation.riskLabel}</Badge>
          {recommendation.safetyVerdict && (
            <Badge tone={SAFETY_TONE[recommendation.safetyVerdict]}>Safety: {recommendation.safetyVerdict}</Badge>
          )}
          {recommendation.decisionOutcome && (
            <Badge tone={DECISION_TONE[recommendation.decisionOutcome]}>
              {DECISION_LABELS[recommendation.decisionOutcome]}
            </Badge>
          )}
        </div>
      </div>

      {/* Root cause */}
      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Root Cause Hypothesis</h3>
        <p className="mt-1 text-sm text-slate-200">{recommendation.rootCauseHypothesis}</p>
        <p className="mt-1 text-xs text-slate-500">
          Confidence: {(recommendation.rootCauseConfidence * 100).toFixed(0)}%
        </p>
      </div>

      {/* Remediation summary + steps */}
      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remediation</h3>
        <p className="mt-1 text-sm text-slate-200">{recommendation.summary}</p>
        <ol className="mt-3 space-y-1.5">
          {recommendation.actionSteps.map((step) => (
            <li key={step.order} className="flex gap-2 text-sm text-slate-300">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-400">
                {step.order}
              </span>
              <span>{step.description}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Rollback */}
      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rollback Guidance</h3>
        <p className="mt-1 text-sm text-slate-300">{recommendation.rollbackGuidance}</p>
      </div>

      {/* Grounded references */}
      {recommendation.groundedReferences.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Grounded in Retrieved Context
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recommendation.groundedReferences.map((ref) => (
              <li key={ref}>
                <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{ref}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Safety flags */}
      {flags.length > 0 && (
        <div className="mt-5 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-400">Safety Flags</h3>
          <ul className="mt-2 space-y-1">
            {flags.map((flag, i) => (
              <li key={i} className="text-sm text-rose-200">
                <span className="font-medium">{flag.type}</span>
                {flag.severity && <span className="text-rose-400"> ({flag.severity})</span>}: {flag.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-600">
        Recommendation confidence: {(recommendation.confidenceScore * 100).toFixed(0)}% · Prompt:{" "}
        {recommendation.promptVersion}
      </p>

      {/* Actions */}
      <div className="mt-6 border-t border-slate-800 pt-5">
        <h3 className="text-sm font-semibold text-slate-100">Human Decision</h3>
        {isBlocked ? (
          <p className="mt-2 rounded-lg bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
            This remediation was flagged <strong>UNSAFE</strong> by the safety validator and cannot be approved.
            Escalate or block only.
          </p>
        ) : isHighRisk && !canApproveHighRisk ? (
          <p className="mt-2 rounded-lg bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
            This is a {recommendation.riskLabel}-risk remediation. Only a Senior Engineer or Admin can approve it.
          </p>
        ) : null}

        {isActionable ? (
          <>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason / notes (recorded in the audit log)"
              rows={2}
              className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-volt focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => act("approve")}
                disabled={busy !== null || isBlocked || (isHighRisk && !canApproveHighRisk)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                onClick={() => act("escalate")}
                disabled={busy !== null}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-40"
              >
                {busy === "escalate" ? "Escalating…" : "Escalate to Human"}
              </button>
              <button
                onClick={() => act("block")}
                disabled={busy !== null}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-40"
              >
                {busy === "block" ? "Blocking…" : "Block Unsafe"}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No pending decision — incident is currently <strong>{incident.status}</strong>.
          </p>
        )}
      </div>
    </section>
  );
}
