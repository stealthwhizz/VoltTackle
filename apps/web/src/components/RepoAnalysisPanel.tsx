"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export function RepoAnalysisPanel({ onStarted }: { onStarted?: () => void }) {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.analyzeRepo(repoUrl.trim(), context.trim() || undefined);
      onStarted?.();
      router.push(`/incidents/${res.incidentId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start analysis");
      setBusy(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-xl border border-volt/25 bg-night-900/60 p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-volt/10 blur-2xl" />
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-volt/15 text-volt">🔎</span>
        <h2 className="text-base font-semibold text-white">Postmortem a GitHub repo</h2>
        <span className="rounded-full border border-volt/30 bg-volt/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-volt">
          multi-agent
        </span>
      </div>
      <p className="mt-1.5 text-sm text-slate-400">
        Paste a repository URL. Featherless asks the questions, GitAgent (on Lyzr) digs the git history to
        answer them, and the findings drive a repo-grounded postmortem.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          type="url"
          required
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-volt focus:outline-none"
        />
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          placeholder="Optional: what happened / what to focus on (e.g. 'errors after the latest deploy')"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-volt focus:outline-none"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || !repoUrl.trim()}
          className="w-full rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-volt-bright volt-glow-sm disabled:opacity-50"
        >
          {busy ? "Cloning & analyzing…" : "Analyze repository"}
        </button>
      </form>
    </section>
  );
}
