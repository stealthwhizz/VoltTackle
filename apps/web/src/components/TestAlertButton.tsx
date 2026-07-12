"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const SCENARIOS = [
  {
    label: "Deploy Regression",
    payload: {
      source: "datadog",
      alertName: "5xx error rate spike",
      service: "checkout-api",
      severity: "SEV2",
      message:
        "checkout-api 5xx error rate spiked to 12 percent minutes after the latest deploy rolled out; schema migration suspected",
      tags: ["checkout-api", "5xx", "deploy"],
    },
  },
  {
    label: "Dependency Outage",
    payload: {
      source: "datadog",
      alertName: "Payment authorize timeouts",
      service: "payments-service",
      severity: "SEV1",
      message:
        "payments-service seeing 40 percent authorize timeouts from the primary payment processor; downstream dependency outage suspected",
      tags: ["payments-service", "third-party", "timeout"],
    },
  },
  {
    label: "Suspicious Traffic",
    payload: {
      source: "prometheus",
      alertName: "Auth failure spike",
      service: "auth-service",
      severity: "SEV2",
      message:
        "Massive spike in failed login attempts from a narrow IP range; credential stuffing pattern / suspicious traffic detected",
      tags: ["auth-service", "suspicious-traffic", "security"],
    },
  },
  {
    label: "Infra Failure",
    payload: {
      source: "prometheus",
      alertName: "DB connection pool exhaustion",
      service: "checkout-api",
      severity: "SEV2",
      message:
        "checkout-api reporting too many connections errors and request timeouts; database connection pool exhaustion suspected",
      tags: ["checkout-api", "infra", "database"],
    },
  },
];

export function TestAlertButton({ onSent }: { onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function send(scenario: (typeof SCENARIOS)[number]) {
    setBusy(scenario.label);
    try {
      await api.sendTestAlert({
        ...scenario.payload,
        externalId: `ui-test-${Date.now()}`,
      });
      onSent();
      setOpen(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-volt-bright volt-glow-sm"
      >
        + Send test alert
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-night-800 bg-night-900 p-2 shadow-xl">
          <p className="px-2 py-1 text-xs text-slate-500">Simulate a monitoring webhook:</p>
          {SCENARIOS.map((s) => (
            <button
              key={s.label}
              onClick={() => send(s)}
              disabled={busy !== null}
              className="block w-full rounded px-2 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === s.label ? "Sending…" : s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
