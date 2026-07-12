import type { IncidentEventDto } from "@volt-tackle/shared";

interface InvestigationItem {
  question: string;
  answer: string;
}

/**
 * Surfaces the multi-agent repo investigation that already lives in incident
 * events: the questions Featherless generated (REPO_QUESTIONS_GENERATED) and
 * the answers GitAgent/Lyzr produced (REPO_CONTEXT_FETCHED.metadata). Reads
 * existing event metadata only — no new backend shape. Renders nothing for
 * incidents that had no repo analysis, so it's safe on every incident.
 */
export function RepoInvestigationPanel({ events }: { events: IncidentEventDto[] }) {
  const questionsEvent = events.find((e) => e.type === "REPO_QUESTIONS_GENERATED");
  const contextEvent = events.find((e) => e.type === "REPO_CONTEXT_FETCHED");

  const questions = asStringArray(questionsEvent?.metadata?.["questions"]);
  const investigation = asInvestigation(contextEvent?.metadata?.["investigation"]);
  const repo = typeof contextEvent?.metadata?.["repo"] === "string" ? (contextEvent.metadata["repo"] as string) : null;
  const suspects = asStringArray(contextEvent?.metadata?.["suspectSignals"]);

  // Nothing to show for a normal (non-repo) incident.
  if (!questionsEvent && !contextEvent) return null;

  const analyzing = questionsEvent && !contextEvent;

  return (
    <section className="relative overflow-hidden rounded-xl border border-volt/25 bg-night-900/60 p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-volt/10 blur-3xl" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-volt/15 text-volt">🔎</span>
          <h2 className="text-lg font-semibold text-white">Repo Investigation</h2>
          <span className="rounded-full border border-volt/30 bg-volt/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-volt">
            multi-agent
          </span>
        </div>
        {repo && (
          <a
            href={repo.startsWith("http") ? repo : undefined}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-slate-400 hover:text-volt"
          >
            {repo}
          </a>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Featherless generated the questions; GitAgent (on Lyzr) answered each from the git history.
      </p>

      {/* Answered Q&A (preferred) */}
      {investigation.length > 0 ? (
        <ol className="mt-5 space-y-4">
          {investigation.map((item, i) => (
            <li key={i} className="rounded-lg border border-night-800 bg-night-950/40 p-4">
              <div className="flex gap-2">
                <span className="font-mono text-xs font-bold text-volt">Q{i + 1}</span>
                <span className="text-sm font-medium text-slate-200">{item.question}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{item.answer}</p>
            </li>
          ))}
        </ol>
      ) : (
        /* Fall back to just the generated questions while GitAgent is still running */
        questions.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {analyzing ? "Investigating…" : "Questions"}
            </h3>
            <ul className="mt-2 space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-300">
                  <span className="font-mono text-xs font-bold text-volt">Q{i + 1}</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
            {analyzing && (
              <p className="mt-3 text-xs text-slate-500">GitAgent is excavating the git history to answer these…</p>
            )}
          </div>
        )
      )}

      {/* Suspect signals, if any */}
      {suspects.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suspect changes</h3>
          <ul className="mt-2 space-y-1">
            {suspects.map((s, i) => (
              <li key={i} className="text-sm text-slate-400">
                • {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asInvestigation(value: unknown): InvestigationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({ question: String(v.question ?? ""), answer: String(v.answer ?? "") }))
    .filter((v) => v.question || v.answer);
}
