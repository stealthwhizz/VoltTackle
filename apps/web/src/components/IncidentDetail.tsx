"use client";

import Link from "next/link";
import useSWR from "swr";
import type { IncidentDetailDto } from "@volt-tackle/shared";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { Timeline } from "@/components/Timeline";
import { PostmortemViewer } from "@/components/PostmortemViewer";
import { RepoInvestigationPanel } from "@/components/RepoInvestigationPanel";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
  SEVERITY_TONE,
  formatTimestamp,
} from "@/lib/format";

// Statuses where the pipeline is still running; poll faster to show progress.
const IN_PROGRESS = new Set(["NEW", "TRIAGING", "RETRIEVING_CONTEXT", "ANALYZING"]);

export function IncidentDetail({ id }: { id: string }) {
  const { data, error, isLoading, mutate } = useSWR(
    ["incident", id],
    () => api.getIncident(id),
    { refreshInterval: (latest) => (latest && IN_PROGRESS.has(latest.status) ? 2000 : 6000) },
  );

  if (error) return <p className="text-sm text-rose-400">Failed to load incident.</p>;
  if (isLoading || !data) return <p className="text-sm text-slate-500">Loading incident…</p>;

  const latestRecommendation = data.recommendations[data.recommendations.length - 1];

  function applyUpdate(updated: IncidentDetailDto) {
    mutate(updated, { revalidate: true });
  }

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-slate-400 transition hover:text-volt">
        ← Back to incidents
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{data.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{data.description}</p>
          <p className="mt-1 text-xs text-slate-600">
            {data.service} · {data.source} · created {formatTimestamp(data.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.category && <Badge tone="info">{CATEGORY_LABELS[data.category]}</Badge>}
          <Badge tone={SEVERITY_TONE[data.severity]}>{data.severity}</Badge>
          <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABELS[data.status]}</Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {latestRecommendation ? (
            <RecommendationPanel incident={data} recommendation={latestRecommendation} onChange={applyUpdate} />
          ) : (
            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-slate-100">AI Analysis in progress…</h2>
              <p className="mt-2 text-sm text-slate-400">
                The incident pipeline is triaging, retrieving context, and drafting a remediation. This view
                refreshes automatically.
              </p>
            </section>
          )}

          <RepoInvestigationPanel events={data.events} />

          {data.postmortem && <PostmortemViewer postmortem={data.postmortem} />}
        </div>

        <div className="lg:col-span-1">
          <Timeline events={data.events} />
        </div>
      </div>
    </div>
  );
}
