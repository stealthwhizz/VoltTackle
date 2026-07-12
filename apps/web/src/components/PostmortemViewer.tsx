import type { PostmortemDto } from "@volt-tackle/shared";
import { Badge } from "@/components/Badge";
import { formatTimestamp } from "@/lib/format";

export function PostmortemViewer({ postmortem }: { postmortem: PostmortemDto }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Postmortem</h2>
        <Badge tone={postmortem.status === "FINALIZED" ? "success" : "warning"}>{postmortem.status}</Badge>
      </div>
      <h3 className="mt-3 text-base font-medium text-slate-100">{postmortem.title}</h3>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Summary" value={postmortem.summary} />
        <Field label="Impact" value={postmortem.impact} />
        <Field label="Root Cause" value={postmortem.rootCause} className="md:col-span-2" />
      </div>

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline</h4>
        <ol className="mt-2 space-y-1.5">
          {postmortem.timeline.map((t, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-300">
              <span className="shrink-0 text-xs text-slate-500">{formatTimestamp(t.timestamp)}</span>
              <span>{t.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-up Action Items</h4>
        <ul className="mt-2 space-y-1.5">
          {postmortem.actionItems.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-300">
              <span className="text-emerald-400">☐</span>
              <span>
                {item.description}
                {item.owner && <span className="text-slate-500"> — {item.owner}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-slate-600">Prompt: {postmortem.promptVersion}</p>
    </section>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h4>
      <p className="mt-1 text-sm text-slate-300">{value}</p>
    </div>
  );
}
