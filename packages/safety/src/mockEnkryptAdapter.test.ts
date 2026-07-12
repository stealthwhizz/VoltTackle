import { describe, it, expect } from "vitest";
import { MockEnkryptAdapter } from "./mockEnkryptAdapter.js";

const adapter = new MockEnkryptAdapter();

function input(overrides: Partial<Parameters<MockEnkryptAdapter["validate"]>[0]> = {}) {
  return {
    remediationSummary: "Roll back checkout-api to the previous stable SHA.",
    actionSteps: ["Trigger CI/CD rollback to the last stable deploy", "Verify 5xx returns to baseline"],
    rollbackGuidance: "Standard rollback via CI/CD; no manual data changes.",
    riskLabel: "MEDIUM" as const,
    ...overrides,
  };
}

describe("MockEnkryptAdapter verdicts", () => {
  it("returns SAFE with no flags for a benign, low/medium-risk remediation", async () => {
    const r = await adapter.validate(input({ riskLabel: "LOW" }));
    expect(r.verdict).toBe("SAFE");
    expect(r.flags).toHaveLength(0);
    expect(r.provider).toBe("mock");
  });

  it("returns UNSAFE and a destructive_command flag for `drop table`", async () => {
    const r = await adapter.validate(input({ actionSteps: ["drop table checkout_orders;"] }));
    expect(r.verdict).toBe("UNSAFE");
    expect(r.flags.some((f) => f.type === "destructive_command")).toBe(true);
  });

  it("returns UNSAFE for `rm -rf` in the rollback guidance", async () => {
    const r = await adapter.validate(input({ rollbackGuidance: "run rm -rf /var/lib/postgresql to reclaim space" }));
    expect(r.verdict).toBe("UNSAFE");
    expect(r.flags.some((f) => f.type === "destructive_command" && f.severity === "CRITICAL")).toBe(true);
  });

  it("escalates a CRITICAL-risk remediation to NEEDS_REVIEW even when the text is benign", async () => {
    const r = await adapter.validate(input({ riskLabel: "CRITICAL" }));
    expect(r.verdict).toBe("NEEDS_REVIEW");
    expect(r.flags.length).toBeGreaterThan(0);
  });

  it("routes a HIGH-risk benign remediation to NEEDS_REVIEW", async () => {
    const r = await adapter.validate(input({ riskLabel: "HIGH" }));
    expect(r.verdict).toBe("NEEDS_REVIEW");
  });

  it("flags a secret/token-shaped string as a secret_leak", async () => {
    const r = await adapter.validate(input({ remediationSummary: "Rotate key sk-ABCDEFGHIJKLMNOPQRSTUVWX12345" }));
    expect(r.flags.some((f) => f.type === "secret_leak")).toBe(true);
  });

  it("always stamps provider=mock and an ISO timestamp", async () => {
    const r = await adapter.validate(input());
    expect(r.provider).toBe("mock");
    expect(() => new Date(r.evaluatedAt).toISOString()).not.toThrow();
  });
});
