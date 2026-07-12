import Link from "next/link";
import { BoltIcon } from "@/components/AppHeader";

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* ambient glows */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-volt/20 blur-[120px]"
        aria-hidden="true"
      />

      {/* nav */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-volt text-night-950 volt-glow-sm">
              <BoltIcon className="h-5 w-5 flicker" />
            </span>
            <span className="text-[17px] font-bold tracking-tight text-white">Volt Tackle</span>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-volt-bright volt-glow-sm"
          >
            Launch app →
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-night-800 bg-night-900/70 px-3 py-1 font-mono text-xs text-volt-200">
          <span className="h-1.5 w-1.5 rounded-full bg-volt spark" />
          AI incident response · safety-gated · multi-agent
        </div>

        <h1 className="mt-6 max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-7xl">
          Your senior engineer,
          <br />
          <span className="text-volt volt-text-glow">on call at 2&nbsp;AM.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
          Volt Tackle turns a raw alert into a triaged incident, a{" "}
          <span className="text-white">context-grounded</span> root cause, and a{" "}
          <span className="text-white">safety-validated</span> fix — then drafts the postmortem and learns
          from it. Every AI suggestion clears a mandatory safety gate before a human ever clicks approve.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-volt px-6 py-3 text-base font-semibold text-night-950 transition hover:bg-volt-bright volt-glow"
          >
            Open the dashboard
          </Link>
          <a
            href="#how"
            className="rounded-xl border border-night-800 bg-night-900/60 px-6 py-3 text-base font-medium text-slate-200 transition hover:border-volt/40 hover:text-white"
          >
            How it works
          </a>
        </div>

        {/* animated current wire */}
        <div className="mt-14 h-px w-full max-w-3xl current-line" aria-hidden="true" />

        <div className="mt-8 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-night-800 bg-night-900/50 p-4">
              <div className="font-mono text-2xl font-bold text-volt">{s.value}</div>
              <div className="mt-1 text-xs text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* pipeline */}
      <section id="how" className="relative z-10 border-t border-night-800/60 bg-night-950/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionEyebrow>The lifecycle</SectionEyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Alert in. Grounded, safety-checked resolution out.
          </h2>
          <p className="mt-3 max-w-2xl text-slate-400">
            A Mastra workflow runs the whole chain in seconds, persisting every step to Postgres so a restart
            never loses an incident.
          </p>

          <div className="mt-10 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {PIPELINE.map((step, i) => (
              <div
                key={step.title}
                className="group relative rounded-xl border border-night-800 bg-night-900/60 p-4 transition hover:border-volt/40"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-night-800 font-mono text-xs text-volt">
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-white">{step.title}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* two feature panels */}
      <section className="relative z-10">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-20 lg:grid-cols-2">
          <FeatureCard
            tag="Multi-agent"
            title="Repo archaeology, on demand"
            body="Paste a GitHub URL. Featherless generates sharp investigative questions; GitAgent — running on Lyzr — clones the repo and excavates the git history to answer each, citing real commits. Featherless synthesizes it into a postmortem."
            points={["Featherless asks →", "GitAgent (Lyzr) answers from git history →", "Postmortem, grounded in real commits"]}
          />
          <FeatureCard
            tag="Safety first"
            title="Nothing dangerous gets approved"
            body="Every remediation is scanned by Enkrypt AI for destructive commands, secret leaks, and unsupported certainty. The verdict is deterministic — an LLM never approves its own fix — and unsafe suggestions are hard-blocked."
            points={["SAFE → approve for review", "NEEDS_REVIEW → escalate to human", "UNSAFE → blocked, 403 on approve"]}
          />
        </div>
      </section>

      {/* tech strip */}
      <section className="relative z-10 border-y border-night-800/60 bg-night-950/40">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-center font-mono text-xs uppercase tracking-widest text-slate-500">
            Powered by a real, provider-agnostic stack
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-slate-300">
            {TECH.map((t) => (
              <span key={t} className="transition hover:text-volt">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <BoltIcon className="mx-auto h-10 w-10 text-volt volt-text-glow flicker" />
          <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Stop firefighting alone.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Let the AI do the investigation. You stay in control of the fix.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-block rounded-xl bg-volt px-7 py-3.5 text-base font-semibold text-night-950 transition hover:bg-volt-bright volt-glow"
          >
            Launch Volt Tackle →
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-night-800/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row">
          <span className="flex items-center gap-2">
            <BoltIcon className="h-3.5 w-3.5 text-volt" /> Volt Tackle
          </span>
          <span>AI incident response · runs fully offline with mocks · one env var to go live.</span>
        </div>
      </footer>
    </div>
  );
}

const STATS = [
  { value: "4", label: "Incident categories" },
  { value: "7", label: "AI agents" },
  { value: "100%", label: "Fixes safety-scanned" },
  { value: "0", label: "Unsafe auto-executions" },
];

const PIPELINE = [
  { title: "Triage", desc: "Classify into deploy / infra / dependency / suspicious-traffic." },
  { title: "Retrieve", desc: "Semantic search over Qdrant memory + git history." },
  { title: "Root cause", desc: "Hypothesis grounded in real retrieved evidence." },
  { title: "Remediate", desc: "Steps, risk label, rollback, confidence." },
  { title: "Safety gate", desc: "Enkrypt verdict → approve / escalate / block." },
  { title: "Postmortem", desc: "Blameless draft, indexed back into memory." },
];

const TECH = [
  "Featherless AI",
  "GitAgent",
  "Lyzr",
  "Qdrant",
  "Enkrypt AI",
  "Mastra",
  "PostgreSQL",
  "Next.js",
  "Fastify",
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-volt">
      <span className="h-px w-6 bg-volt" />
      {children}
    </div>
  );
}

function FeatureCard({
  tag,
  title,
  body,
  points,
}: {
  tag: string;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-night-800 bg-night-900/60 p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-volt/10 blur-3xl" />
      <span className="inline-block rounded-full border border-volt/30 bg-volt/10 px-2.5 py-0.5 font-mono text-xs text-volt">
        {tag}
      </span>
      <h3 className="mt-4 text-xl font-bold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{body}</p>
      <ul className="mt-5 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-slate-300">
            <BoltIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-volt" />
            <span className="font-mono text-[13px]">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
