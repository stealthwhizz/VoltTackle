import type { SafetyValidationInput, SafetyValidationOutput } from "@volt-tackle/shared";

export type SafetyAdapterName = "enkrypt" | "mock";

/**
 * Clean seam over the safety/guardrails layer. The PRD requires 100% of
 * remediation suggestions to pass through this before being exposed to a
 * user or executed — see packages/workflows' safety-gate step.
 */
export interface SafetyAdapter {
  readonly name: SafetyAdapterName;
  validate(input: SafetyValidationInput): Promise<SafetyValidationOutput>;
}
