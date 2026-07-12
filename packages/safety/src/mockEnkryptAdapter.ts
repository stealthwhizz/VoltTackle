import type { SafetyFlag, SafetyValidationInput, SafetyValidationOutput } from "@volt-tackle/shared";
import type { SafetyAdapter } from "./types.js";
import { DESTRUCTIVE_COMMAND_PATTERNS, SECRET_OR_PII_PATTERNS, findMatches } from "./destructivePatterns.js";

/**
 * Heuristic, offline safety adapter with the same decision shape as the real
 * Enkrypt integration: destructive-command detection, secret/PII scanning,
 * and a risk/confidence-aware fallback for hallucination risk. Active by
 * default when ENKRYPT_API_KEY is not configured.
 */
export class MockEnkryptAdapter implements SafetyAdapter {
  readonly name = "mock" as const;

  async validate(input: SafetyValidationInput): Promise<SafetyValidationOutput> {
    const combinedText = [input.remediationSummary, ...input.actionSteps, input.rollbackGuidance].join("\n");
    const flags: SafetyFlag[] = [];

    const destructiveMatches = findMatches(DESTRUCTIVE_COMMAND_PATTERNS, combinedText);
    if (destructiveMatches.length > 0) {
      flags.push({
        type: "destructive_command",
        severity: "CRITICAL",
        detail: `Detected destructive command pattern(s): ${destructiveMatches.join(", ")}`,
      });
    }

    const secretMatches = findMatches(SECRET_OR_PII_PATTERNS, combinedText);
    if (secretMatches.length > 0) {
      flags.push({
        type: "secret_leak",
        severity: "HIGH",
        detail: "Detected a token/PII-shaped string in the remediation text.",
      });
    }

    if (input.riskLabel === "CRITICAL" && destructiveMatches.length === 0) {
      flags.push({
        type: "hallucination_risk",
        severity: "HIGH",
        detail: "Remediation carries a CRITICAL risk label — requires human review before any action is taken.",
      });
    }

    const verdict = deriveVerdict(flags, input.riskLabel);

    return {
      verdict,
      flags,
      provider: "mock",
      evaluatedAt: new Date().toISOString(),
      rationale: rationaleFor(verdict, flags),
    };
  }
}

function deriveVerdict(flags: SafetyFlag[], riskLabel: SafetyValidationInput["riskLabel"]): SafetyValidationOutput["verdict"] {
  if (flags.some((f) => f.type === "destructive_command" || f.severity === "CRITICAL")) {
    return "UNSAFE";
  }
  if (flags.length > 0 || riskLabel === "HIGH") {
    return "NEEDS_REVIEW";
  }
  return "SAFE";
}

function rationaleFor(verdict: SafetyValidationOutput["verdict"], flags: SafetyFlag[]): string {
  if (verdict === "UNSAFE") {
    return "Blocked: remediation contains a destructive command or critical-severity flag that must not be auto-approved.";
  }
  if (verdict === "NEEDS_REVIEW") {
    return flags.length > 0
      ? "Escalated: one or more moderate-severity safety flags require human review before proceeding."
      : "Escalated: risk label is HIGH — routed to a human for review even though no explicit safety flags were found.";
  }
  return "No destructive commands, secrets, or high-risk flags detected. Safe to present for approval.";
}
