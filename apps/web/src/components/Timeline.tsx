import type { IncidentEventDto } from "@volt-tackle/shared";
import { formatTimestamp } from "@/lib/format";

const EVENT_ICONS: Record<string, string> = {
  ALERT_RECEIVED: "📥",
  WORKFLOW_QUEUED: "⏳",
  TRIAGE_COMPLETE: "🏷️",
  RETRIEVAL_COMPLETE: "🔎",
  ANALYSIS_COMPLETE: "🧠",
  SAFETY_DECISION: "🛡️",
  APPROVAL_DECISION: "✅",
  POSTMORTEM_GENERATED: "📝",
  WORKFLOW_FAILED: "⚠️",
};

export function Timeline({ events }: { events: IncidentEventDto[] }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-slate-100">Timeline</h2>
      <ol className="mt-4 space-y-4">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm">
              {EVENT_ICONS[event.type] ?? "•"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-slate-200">{event.type.replace(/_/g, " ")}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatTimestamp(event.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">{event.message}</p>
              <p className="text-xs text-slate-600">{event.actor}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
