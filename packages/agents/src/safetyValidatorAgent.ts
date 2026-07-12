import { z } from "zod";
import type { SafetyValidationInput, SafetyValidationOutput } from "@volt-tackle/shared";
import type { SafetyAdapter } from "@volt-tackle/safety";
import { withAgentSpan, recordLlmUsage, recordSafetyVerdict } from "@volt-tackle/observability";
import { loadPrompt } from "./promptLoader.js";
import type { AgentDeps, AgentRunContext } from "./types.js";

const AGENT_NAME = "safety-validator";

const RationaleSchema = z.object({ rationale: z.string() });

/**
 * The verdict itself is decided deterministically by the SafetyAdapter
 * (Enkrypt or its mock) — this agent never overrides that. It only asks the
 * LLM to phrase a clearer explanation of an already-final decision, and
 * falls back to the adapter's own rationale if that phrasing call fails, so
 * a flaky LLM can never block or unblock a safety verdict.
 */
export async function runSafetyValidatorAgent(
  input: SafetyValidationInput,
  deps: AgentDeps & { safetyAdapter: SafetyAdapter },
  ctx: AgentRunContext,
): Promise<{ output: SafetyValidationOutput; promptVersion: string }> {
  const prompt = loadPrompt(AGENT_NAME);

  return withAgentSpan(
    deps.tracer,
    { incidentId: ctx.incidentId, correlationId: ctx.correlationId, agentName: AGENT_NAME, promptVersion: prompt.versionId },
    async (span) => {
      const verdictResult = await deps.safetyAdapter.validate(input);
      recordSafetyVerdict(span, verdictResult.verdict);

      let rationale = verdictResult.rationale;
      try {
        const phrased = await deps.llmProvider.generateStructured({
          schema: RationaleSchema,
          schemaName: "SafetyRationale",
          system: prompt.content,
          prompt: [
            `Verdict: ${verdictResult.verdict}`,
            `Flags: ${verdictResult.flags.map((f) => `${f.type} (${f.severity}): ${f.detail}`).join("; ") || "(none)"}`,
            `Remediation summary: ${input.remediationSummary}`,
          ].join("\n"),
        });
        recordLlmUsage(span, {
          provider: phrased.meta.provider,
          model: phrased.meta.model,
          promptTokens: phrased.meta.promptTokens,
          completionTokens: phrased.meta.completionTokens,
        });
        rationale = phrased.data.rationale;
      } catch (err) {
        deps.logger.warn({ err, incidentId: ctx.incidentId }, "Safety rationale phrasing failed; using adapter's raw rationale.");
      }

      const output: SafetyValidationOutput = { ...verdictResult, rationale };
      return { output, promptVersion: `${AGENT_NAME}@${prompt.versionId}` };
    },
  );
}
