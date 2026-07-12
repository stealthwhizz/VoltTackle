import { TriageOutputSchema, type TriageInput, type TriageOutput } from "@volt-tackle/shared";
import { withAgentSpan, recordLlmUsage } from "@volt-tackle/observability";
import { loadPrompt } from "./promptLoader.js";
import { AgentExecutionError, type AgentDeps, type AgentRunContext } from "./types.js";

const AGENT_NAME = "triage-agent";

export async function runTriageAgent(
  input: TriageInput,
  deps: AgentDeps,
  ctx: AgentRunContext,
): Promise<{ output: TriageOutput; promptVersion: string }> {
  const prompt = loadPrompt(AGENT_NAME);

  return withAgentSpan(
    deps.tracer,
    { incidentId: ctx.incidentId, correlationId: ctx.correlationId, agentName: AGENT_NAME, promptVersion: prompt.versionId },
    async (span) => {
      const userPrompt = buildUserPrompt(input);

      try {
        const result = await deps.llmProvider.generateStructured({
          schema: TriageOutputSchema,
          schemaName: "TriageOutput",
          system: prompt.content,
          prompt: userPrompt,
        });

        recordLlmUsage(span, {
          provider: result.meta.provider,
          model: result.meta.model,
          promptTokens: result.meta.promptTokens,
          completionTokens: result.meta.completionTokens,
        });

        deps.logger.info(
          { incidentId: ctx.incidentId, agent: AGENT_NAME, category: result.data.category, confidence: result.data.confidence },
          "Triage complete",
        );

        return { output: result.data, promptVersion: `${AGENT_NAME}@${prompt.versionId}` };
      } catch (err) {
        throw new AgentExecutionError(AGENT_NAME, "Failed to classify incident", err);
      }
    },
  );
}

function buildUserPrompt(input: TriageInput): string {
  const deploysText =
    input.recentDeploys.length > 0
      ? input.recentDeploys.map((d) => `- ${d.sha} by ${d.author} at ${d.deployedAt}: ${d.message}`).join("\n")
      : "(no recent deploys found)";

  return [
    `Alert: ${input.alertName}`,
    `Service: ${input.service}`,
    `Severity: ${input.severity}`,
    `Message: ${input.message}`,
    `Tags: ${input.tags.join(", ") || "(none)"}`,
    `Recent deploys:\n${deploysText}`,
  ].join("\n");
}
