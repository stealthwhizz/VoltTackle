import { RootCauseOutputSchema, type RootCauseInput, type RootCauseOutput } from "@volt-tackle/shared";
import { withAgentSpan, recordLlmUsage } from "@volt-tackle/observability";
import { loadPrompt } from "./promptLoader.js";
import { filterGroundedReferences } from "./grounding.js";
import { AgentExecutionError, type AgentDeps, type AgentRunContext } from "./types.js";

const AGENT_NAME = "root-cause-agent";

export async function runRootCauseAgent(
  input: RootCauseInput,
  deps: AgentDeps,
  ctx: AgentRunContext,
): Promise<{ output: RootCauseOutput; promptVersion: string }> {
  const prompt = loadPrompt(AGENT_NAME);

  return withAgentSpan(
    deps.tracer,
    { incidentId: ctx.incidentId, correlationId: ctx.correlationId, agentName: AGENT_NAME, promptVersion: prompt.versionId },
    async (span) => {
      const userPrompt = buildUserPrompt(input);

      try {
        const result = await deps.llmProvider.generateStructured({
          schema: RootCauseOutputSchema,
          schemaName: "RootCauseOutput",
          system: prompt.content,
          prompt: userPrompt,
        });

        recordLlmUsage(span, {
          provider: result.meta.provider,
          model: result.meta.model,
          promptTokens: result.meta.promptTokens,
          completionTokens: result.meta.completionTokens,
        });

        // Grounding enforced in code: only refs that were actually retrieved
        // (per the PRD's "grounded in retrieved context, not pure LLM
        // generation" requirement) survive into the persisted output. If the
        // model didn't cite any of the real refs, fall back to the top
        // retrieved refs rather than surfacing an empty, ungrounded result.
        const groundedReferences = filterGroundedReferences(result.data.groundedReferences, input.retrievalRefs);

        return {
          output: { ...result.data, groundedReferences },
          promptVersion: `${AGENT_NAME}@${prompt.versionId}`,
        };
      } catch (err) {
        throw new AgentExecutionError(AGENT_NAME, "Failed to determine root cause", err);
      }
    },
  );
}

function buildUserPrompt(input: RootCauseInput): string {
  const deploysText =
    input.recentDeploys.length > 0
      ? input.recentDeploys.map((d) => `- ${d.sha} by ${d.author} at ${d.deployedAt}: ${d.message}`).join("\n")
      : "(no recent deploys found)";

  const metricsText =
    Object.keys(input.metrics).length > 0
      ? Object.entries(input.metrics).map(([k, v]) => `- ${k}: ${v}`).join("\n")
      : "(no metrics provided)";

  const lines = [
    `Incident: ${input.incidentSummary}`,
    `Category: ${input.category}`,
    `Retrieved context summary: ${input.retrievalSummary}`,
    `Available grounded references: ${input.retrievalRefs.join(", ") || "(none)"}`,
    `Recent deploys:\n${deploysText}`,
    `Metrics:\n${metricsText}`,
  ];

  // Repository context is optional and only present for code/deploy-related
  // incidents when a RepoContextProvider is enabled. Treated as grounded data
  // the model may cite (commit SHAs), consistent with the v1 prompt's rule to
  // correlate deploy metadata.
  if (input.repoContext?.available) {
    const rc = input.repoContext;
    const commitsText =
      rc.recentCommits.length > 0
        ? rc.recentCommits
            .map((c) => `- ${c.sha} by ${c.author} (${c.date}): ${c.message}${c.changedFiles.length ? ` [files: ${c.changedFiles.slice(0, 5).join(", ")}]` : ""}`)
            .join("\n")
        : "(no commits extracted)";
    lines.push(
      `Repository context (source: ${rc.provider}${rc.repo ? `, repo: ${rc.repo}` : ""}${rc.ref ? `@${rc.ref}` : ""}):`,
      `Recent commits:\n${commitsText}`,
      `Suspect changes:\n${rc.suspectSignals.length ? rc.suspectSignals.map((s) => `- ${s}`).join("\n") : "(none flagged)"}`,
    );

    // Multi-agent git archaeology: questions asked by the investigator and
    // answered by GitAgent against the repo history. This is the strongest
    // grounding available — prefer it when forming the hypothesis.
    if (rc.investigation.length > 0) {
      const qa = rc.investigation.map((i) => `Q: ${i.question}\nA: ${i.answer}`).join("\n\n");
      lines.push(`Git-history investigation (GitAgent findings):\n${qa}`);
    }
  }

  return lines.join("\n");
}
