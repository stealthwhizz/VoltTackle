"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { IncidentDto } from "@volt-tackle/shared";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
  SEVERITY_TONE,
  formatRelativeTime,
} from "@/lib/format";
import { TestAlertButton } from "@/components/TestAlertButton";
import { RepoAnalysisPanel } from "@/components/RepoAnalysisPanel";

const STATUS_FILTERS = ["", "AWAITING_APPROVAL", "ESCALATED", "BLOCKED", "RESOLVED", "POSTMORTEM_DRAFTED"] as const;

export function IncidentList() {
  const [status, setStatus] = useState<string>("");
  const { data, error, isLoading, mutate } = useSWR(
    ["incidents", status],
    () => api.listIncidents(status ? { status } : undefined),
    { refreshInterval: 4000 },
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Incidents</h1>
          <p className="mt-1 text-sm text-slate-400">
            Live view of AI-triaged incidents and their remediation status.
          </p>
        </div>
        <TestAlertButton onSent={() => mutate()} />
      </div>

      <div className="mt-6">
        <RepoAnalysisPanel onStarted={() => mutate()} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              status === s
                ? "bg-volt text-night-950"
                : "bg-night-800 text-slate-300 hover:bg-night-800/60 hover:text-volt"
            }`}
          >
            {s ? STATUS_LABELS[s as keyof typeof STATUS_LABELS] : "All"}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-rose-400">Failed to load incidents. Is the API running?</p>}
      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading incidents…</p>}

      {data && (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Incident</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.incidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No incidents yet. Send a test alert to trigger the pipeline.
                  </td>
                </tr>
              )}
              {data.incidents.map((incident: IncidentDto) => (
                <tr key={incident.id} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3">
                    <Link href={`/incidents/${incident.id}`} className="font-medium text-slate-100 hover:text-volt">
                      {incident.title}
                    </Link>
                    <div className="text-xs text-slate-500">{incident.service}</div>
                  </td>
                  <td className="px-4 py-3">
                    {incident.category ? (
                      <Badge tone="info">{CATEGORY_LABELS[incident.category]}</Badge>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={SEVERITY_TONE[incident.severity]}>{incident.severity}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[incident.status]}>{STATUS_LABELS[incident.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatRelativeTime(incident.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
