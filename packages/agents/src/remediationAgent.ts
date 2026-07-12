import { RemediationOutputSchema, type RemediationInput, type RemediationOutput } from "@volt-tackle/shared";
import { withAgentSpan, recordLlmUsage } from "@volt-tackle/observability";
import { loadPrompt } from "./promptLoader.js";
import { filterGroundedReferences } from "./grounding.js";
import { AgentExecutionError, type AgentDeps, type AgentRunContext } from "./types.js";

const AGENT_NAME = "remediation-agent";

const SEVERITY_RISK_HINT: Record<RemediationInput["severity"], string> = {
  SEV1: "SEV1 (critical impact — customer-facing outage)",
  SEV2: "SEV2 (high impact — significant degradation)",
  SEV3: "SEV3 (medium impact — limited/partial degradation)",
  SEV4: "SEV4 (low impact — minor or cosmetic)",
};

export async function runRemediationAgent(
  input: RemediationInput,
  deps: AgentDeps,
  ctx: AgentRunContext,
): Promise<{ output: RemediationOutput; promptVersion: string }> {
  const prompt = loadPrompt(AGENT_NAME);

  return withAgentSpan(
    deps.tracer,
    { incidentId: ctx.incidentId, correlationId: ctx.correlationId, agentName: AGENT_NAME, promptVersion: prompt.versionId },
    async (span) => {
      const userPrompt = buildUserPrompt(input);

      try {
        const result = await deps.llmProvider.generateStructured({
          schema: RemediationOutputSchema,
          schemaName: "RemediationOutput",
          system: prompt.content,
          prompt: userPrompt,
        });

        recordLlmUsage(span, {
          provider: result.meta.provider,
          model: result.meta.model,
          promptTokens: result.meta.promptTokens,
          completionTokens: result.meta.completionTokens,
        });

        const groundedReferences = filterGroundedReferences(result.data.groundedReferences, input.groundedReferences);
        // Remediation confidence is capped by root cause confidence: a
        // shaky diagnosis cannot license a highly-confident fix.
        const confidenceScore = Math.min(result.data.confidenceScore, input.rootCauseConfidence + 0.1);

        return {
          output: { ...result.data, groundedReferences, confidenceScore },
          promptVersion: `${AGENT_NAME}@${prompt.versionId}`,
        };
      } catch (err) {
        throw new AgentExecutionError(AGENT_NAME, "Failed to generate remediation", err);
      }
    },
  );
}

export function buildUserPrompt(input: RemediationInput): string {
  const lines = [
    `Incident: ${input.incidentSummary}`,
    `Category: ${input.category}`,
    `Severity: ${SEVERITY_RISK_HINT[input.severity]}`,
    `Root cause hypothesis (confidence ${input.rootCauseConfidence}): ${input.rootCauseHypothesis}`,
    `Retrieved context summary: ${input.retrievalSummary || "(none)"}`,
    `Available grounded references: ${input.groundedReferences.join(", ") || "(none)"}`,
    `Retrieval references: ${input.retrievalRefs.join(", ") || "(none)"}`,
    `Instruction: Tailor the remediation plan to the specific incident evidence, repo context, and grounded references. Do not emit a generic template answer; explicitly reference the observed symptom, affected component, and evidence-backed next step.`,
  ];

  if (input.repoContext?.available) {
    const rc = input.repoContext;
    const commitsText =
      rc.recentCommits.length > 0
        ? rc.recentCommits
            .map((c) => `- ${c.sha} by ${c.author} (${c.date}): ${c.message}`)
            .join("\n")
        : "(no commits extracted)";
    lines.push(
      `Repository context (source: ${rc.provider}${rc.repo ? `, repo: ${rc.repo}` : ""}):`,
      `Summary: ${rc.summary}`,
      `Recent commits:\n${commitsText}`,
      `Suspect changes:\n${rc.suspectSignals.length ? rc.suspectSignals.map((s) => `- ${s}`).join("\n") : "(none flagged)"}`,
    );
  }

  return lines.join("\n");
}
