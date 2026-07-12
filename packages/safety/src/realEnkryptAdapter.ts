import type { SafetyFlag, SafetyValidationInput, SafetyValidationOutput } from "@volt-tackle/shared";
import type { SafetyAdapter } from "./types.js";

export interface EnkryptAdapterConfig {
  apiKey: string;
  baseUrl?: string;
}

interface EnkryptDetectResponse {
  summary: {
    injection_attack?: number;
    nsfw?: number;
    toxicity?: number;
    pii?: number;
    policy_violation?: number;
    keyword_detected?: number;
    bias?: number;
    sponge_attack?: number;
  };
  details?: Record<string, unknown>;
}

/**
 * Real Enkrypt AI Guardrails adapter, calling their documented
 * POST /guardrails/detect endpoint (docs.enkryptai.com). No official
 * Node SDK is published, so this talks to the REST API directly via fetch —
 * see docs/adr/0005-enkrypt-integration.md for details.
 */
export class RealEnkryptAdapter implements SafetyAdapter {
  readonly name = "enkrypt" as const;
  private readonly baseUrl: string;

  constructor(private readonly config: EnkryptAdapterConfig) {
    this.baseUrl = config.baseUrl ?? "https://api.enkryptai.com";
  }

  async validate(input: SafetyValidationInput): Promise<SafetyValidationOutput> {
    const combinedText = [input.remediationSummary, ...input.actionSteps, input.rollbackGuidance].join("\n");

    const response = await fetch(`${this.baseUrl}/guardrails/detect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.config.apiKey,
      },
      body: JSON.stringify({
        text: combinedText,
        detectors: {
          // pii requires an `entities` list when enabled; "pii" is Enkrypt's
          // generic catch-all entity for secrets/identifiers in the text.
          pii: { enabled: true, entities: ["pii"] },
          toxicity: { enabled: true },
          injection_attack: { enabled: true },
          nsfw: { enabled: true },
          keyword_detector: {
            enabled: true,
            banned_keywords: ["rm -rf", "drop table", "truncate table", "chmod 777", "force push"],
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Enkrypt guardrails request failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as EnkryptDetectResponse;
    const flags = mapSummaryToFlags(payload.summary, input.riskLabel);
    const verdict = deriveVerdict(flags, input.riskLabel);

    return {
      verdict,
      flags,
      provider: "enkrypt",
      evaluatedAt: new Date().toISOString(),
      rationale: `Enkrypt guardrails summary: ${JSON.stringify(payload.summary)}`,
    };
  }
}

function mapSummaryToFlags(summary: EnkryptDetectResponse["summary"], riskLabel: SafetyValidationInput["riskLabel"]): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  if (summary.keyword_detected) {
    flags.push({ type: "destructive_command", severity: "CRITICAL", detail: "Enkrypt keyword_detector matched a banned destructive command." });
  }
  if (summary.policy_violation) {
    flags.push({ type: "policy_violation", severity: "HIGH", detail: "Enkrypt policy_violation detector flagged this remediation." });
  }
  if (summary.pii) {
    flags.push({ type: "pii_leak", severity: "HIGH", detail: "Enkrypt pii detector found personally identifiable information." });
  }
  if (summary.injection_attack) {
    flags.push({ type: "hallucination_risk", severity: "HIGH", detail: "Enkrypt injection_attack detector flagged suspicious content." });
  }
  if (riskLabel === "CRITICAL" && flags.length === 0) {
    flags.push({ type: "low_confidence", severity: "MEDIUM", detail: "Risk label is CRITICAL; routing to human review as a precaution." });
  }

  return flags;
}

function deriveVerdict(flags: SafetyFlag[], riskLabel: SafetyValidationInput["riskLabel"]): SafetyValidationOutput["verdict"] {
  if (flags.some((f) => f.severity === "CRITICAL")) return "UNSAFE";
  if (flags.length > 0 || riskLabel === "HIGH") return "NEEDS_REVIEW";
  return "SAFE";
}
