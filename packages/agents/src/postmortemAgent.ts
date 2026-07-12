import { PostmortemOutputSchema, type PostmortemInput, type PostmortemOutput } from "@volt-tackle/shared";
import { withAgentSpan, recordLlmUsage } from "@volt-tackle/observability";
import { loadPrompt } from "./promptLoader.js";
import { AgentExecutionError, type AgentDeps, type AgentRunContext } from "./types.js";

const AGENT_NAME = "postmortem-agent";

export async function runPostmortemAgent(
  input: PostmortemInput,
  deps: AgentDeps,
  ctx: AgentRunContext,
): Promise<{ output: PostmortemOutput; promptVersion: string }> {
  const prompt = loadPrompt(AGENT_NAME);

  return withAgentSpan(
    deps.tracer,
    { incidentId: ctx.incidentId, correlationId: ctx.correlationId, agentName: AGENT_NAME, promptVersion: prompt.versionId },
    async (span) => {
      const userPrompt = buildUserPrompt(input);

      try {
        const result = await deps.llmProvider.generateStructured({
          schema: PostmortemOutputSchema,
          schemaName: "PostmortemOutput",
          system: prompt.content,
          prompt: userPrompt,
        });

        recordLlmUsage(span, {
          provider: result.meta.provider,
          model: result.meta.model,
          promptTokens: result.meta.promptTokens,
          completionTokens: result.meta.completionTokens,
        });

        // Timeline is grounded in code: only the timestamped events actually
        // provided are kept, even if the model paraphrased or reordered them.
        const providedTimestamps = new Set(input.timelineEvents.map((e) => e.timestamp));
        const timeline = result.data.timeline.filter((e) => providedTimestamps.has(e.timestamp));

        return {
          output: { ...result.data, timeline: timeline.length > 0 ? timeline : input.timelineEvents },
          promptVersion: `${AGENT_NAME}@${prompt.versionId}`,
        };
      } catch (err) {
        throw new AgentExecutionError(AGENT_NAME, "Failed to draft postmortem", err);
      }
    },
  );
}

function buildUserPrompt(input: PostmortemInput): string {
  const timelineText = input.timelineEvents.map((e) => `- ${e.timestamp}: ${e.label}`).join("\n");

  return [
    `Incident: ${input.incidentSummary}`,
    `Category: ${input.category}`,
    `Root cause hypothesis: ${input.rootCauseHypothesis}`,
    `Remediation taken: ${input.remediationSummary}`,
    `Action steps taken:\n${input.actionStepsTaken.map((s) => `- ${s}`).join("\n")}`,
    `Decision outcome: ${input.decisionOutcome}`,
    `Timeline:\n${timelineText}`,
  ].join("\n");
}
