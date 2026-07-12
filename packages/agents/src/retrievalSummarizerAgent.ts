import {
  RetrievalSummarizerOutputSchema,
  type RetrievalSummarizerInput,
  type RetrievalSummarizerOutput,
} from "@volt-tackle/shared";
import { withAgentSpan, recordLlmUsage } from "@volt-tackle/observability";
import { loadPrompt } from "./promptLoader.js";
import { AgentExecutionError, type AgentDeps, type AgentRunContext } from "./types.js";

const AGENT_NAME = "retrieval-summarizer";

export async function runRetrievalSummarizerAgent(
  input: RetrievalSummarizerInput,
  deps: AgentDeps,
  ctx: AgentRunContext,
): Promise<{ output: RetrievalSummarizerOutput; promptVersion: string }> {
  const prompt = loadPrompt(AGENT_NAME);

  return withAgentSpan(
    deps.tracer,
    { incidentId: ctx.incidentId, correlationId: ctx.correlationId, agentName: AGENT_NAME, promptVersion: prompt.versionId },
    async (span) => {
      if (input.matches.length === 0) {
        const output: RetrievalSummarizerOutput = {
          summary: "No semantically similar past incidents, runbooks, or service docs were found for this alert.",
          mostRelevantRefs: [],
        };
        return { output, promptVersion: `${AGENT_NAME}@${prompt.versionId}` };
      }

      const userPrompt = buildUserPrompt(input);

      try {
        const result = await deps.llmProvider.generateStructured({
          schema: RetrievalSummarizerOutputSchema,
          schemaName: "RetrievalSummarizerOutput",
          system: prompt.content,
          prompt: userPrompt,
        });

        recordLlmUsage(span, {
          provider: result.meta.provider,
          model: result.meta.model,
          promptTokens: result.meta.promptTokens,
          completionTokens: result.meta.completionTokens,
        });

        // Grounding is enforced in code, not just by prompting: only refs that
        // were actually retrieved are allowed through.
        const validRefs = new Set(input.matches.map((m) => m.externalRef));
        const mostRelevantRefs = result.data.mostRelevantRefs.filter((ref) => validRefs.has(ref));

        return {
          output: { ...result.data, mostRelevantRefs: mostRelevantRefs.length > 0 ? mostRelevantRefs : [...validRefs].slice(0, 3) },
          promptVersion: `${AGENT_NAME}@${prompt.versionId}`,
        };
      } catch (err) {
        throw new AgentExecutionError(AGENT_NAME, "Failed to summarize retrieved context", err);
      }
    },
  );
}

function buildUserPrompt(input: RetrievalSummarizerInput): string {
  const matchesText = input.matches
    .map((m, i) => `${i + 1}. [${m.sourceType}, score=${m.score.toFixed(3)}] "${m.title}" (ref: ${m.externalRef})\n   ${m.snippet}`)
    .join("\n");

  return `Current incident: ${input.incidentSummary}\n\nRetrieved matches:\n${matchesText}`;
}
