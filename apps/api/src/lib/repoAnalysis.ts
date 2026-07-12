import { randomUUID } from "node:crypto";
import { prisma, Prisma } from "@volt-tackle/database";
import { serviceFromRepoUrl, type RepoAnalysisInput } from "@volt-tackle/shared";
import { triggerIncidentWorkflow } from "@volt-tackle/workflows";
import type { AppContext } from "../context.js";

export interface RepoAnalysisResult {
  incidentId: string;
  correlationId: string;
  service: string;
}

/**
 * Turns a pasted GitHub repo URL into an incident whose subject is the repo,
 * then runs the normal pipeline. The repo URL is stored on the incident so the
 * analysis step hands it to the RepoContextProvider (GitAgent → local-git),
 * and the Featherless RCA/postmortem agents reason over the real repo.
 */
export async function startRepoAnalysis(input: RepoAnalysisInput, ctx: AppContext): Promise<RepoAnalysisResult> {
  const service = serviceFromRepoUrl(input.repoUrl);
  const correlationId = randomUUID();
  const description =
    input.context?.trim() ||
    `On-demand repository postmortem for ${input.repoUrl}. Analyze recent commits and changed files for risks, regressions, and follow-ups.`;

  const incident = await prisma.incident.create({
    data: {
      correlationId,
      title: `Repo postmortem — ${service}`,
      service,
      source: "repo-analysis",
      externalId: `repo-${Date.now()}`,
      severity: "SEV3",
      description,
      tags: ["repo-analysis", service],
      rawAlert: { repoUrl: input.repoUrl, kind: "repo-analysis" } as Prisma.InputJsonValue,
    },
  });

  await prisma.incidentEvent.create({
    data: {
      incidentId: incident.id,
      type: "REPO_ANALYSIS_REQUESTED",
      actor: "user",
      message: `Repository postmortem requested for ${input.repoUrl}.`,
      metadata: { repoUrl: input.repoUrl },
    },
  });

  ctx.logger.info({ incidentId: incident.id, repoUrl: input.repoUrl }, "Repo analysis started.");

  // Fire-and-forget: the GitAgent clone + agent loop can take a minute, so we
  // return immediately and let the UI navigate to the incident and poll while
  // the pipeline runs in the background.
  void triggerIncidentWorkflow({ incidentId: incident.id, correlationId }, ctx).catch((err) => {
    ctx.logger.error({ err, incidentId: incident.id }, "Repo analysis workflow failed.");
  });

  return { incidentId: incident.id, correlationId, service };
}
