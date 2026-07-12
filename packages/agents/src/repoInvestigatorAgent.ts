import { RepoInvestigatorOutputSchema, type RepoInvestigatorInput, type RepoInvestigatorOutput } from "@volt-tackle/shared";
import { withAgentSpan, recordLlmUsage } from "@volt-tackle/observability";
import { loadPrompt } from "./promptLoader.js";
import { AgentExecutionError, type AgentDeps, type AgentRunContext } from "./types.js";

const AGENT_NAME = "repo-investigator";

/**
 * Featherless-side of the multi-agent repo investigation: turns an incident +
 * recent commits into a small set of sharp questions for GitAgent (the git
 * archaeologist, on Lyzr) to answer against the repository's history.
 */
export async function runRepoInvestigatorAgent(
  input: RepoInvestigatorInput,
  deps: AgentDeps,
  ctx: AgentRunContext,
): Promise<{ output: RepoInvestigatorOutput; promptVersion: string }> {
  const prompt = loadPrompt(AGENT_NAME);

  return withAgentSpan(
    deps.tracer,
    { incidentId: ctx.incidentId, correlationId: ctx.correlationId, agentName: AGENT_NAME, promptVersion: prompt.versionId },
    async (span) => {
      const commitsText =
        input.recentCommits.length > 0
          ? input.recentCommits.map((c) => `- ${c.sha}: ${c.message}`).join("\n")
          : "(no commit list available)";

      const userPrompt = [
        `Repository: ${input.repo}`,
        `Incident (${input.category}): ${input.incidentSummary}`,
        `Recent commits:\n${commitsText}`,
        `Generate at most ${input.maxQuestions} investigative questions.`,
      ].join("\n");

      try {
        const result = await deps.llmProvider.generateStructured({
          schema: RepoInvestigatorOutputSchema,
          schemaName: "RepoInvestigatorOutput",
          system: prompt.content,
          prompt: userPrompt,
        });
        recordLlmUsage(span, {
          provider: result.meta.provider,
          model: result.meta.model,
          promptTokens: result.meta.promptTokens,
          completionTokens: result.meta.completionTokens,
        });

        const questions = result.data.questions.slice(0, input.maxQuestions);
        return { output: { questions }, promptVersion: `${AGENT_NAME}@${prompt.versionId}` };
      } catch (err) {
        throw new AgentExecutionError(AGENT_NAME, "Failed to generate investigation questions", err);
      }
    },
  );
}
