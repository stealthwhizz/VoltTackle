import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-night-800 bg-night-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt text-night-950 volt-glow-sm transition group-hover:scale-105">
            <BoltIcon className="h-5 w-5" />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold tracking-tight text-white">Volt Tackle</span>
            <span className="hidden rounded bg-night-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-volt-200 sm:inline">
              Incident Response
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 font-medium text-slate-300 transition hover:bg-night-800 hover:text-volt"
          >
            Incidents
          </Link>
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 font-medium text-slate-500 transition hover:bg-night-800 hover:text-slate-200"
          >
            Home
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 2 4 13.2h6.1L9.2 22 20 10.3h-6.4L13.5 2Z" />
    </svg>
  );
}
