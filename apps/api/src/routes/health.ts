import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { prisma } from "@volt-tackle/database";

const exec = promisify(execFile);

export default async function healthRoutes(fastify: FastifyInstance) {
  // TEMPORARY diagnostic: confirms whether `git` and the gitagent library are
  // available in the runtime container (RAILPACK image). Remove after debugging.
  fastify.get("/health/repo-diag", async (_request, reply) => {
    let gitVersion: string | null = null;
    let gitError: string | null = null;
    try {
      const { stdout } = await exec("git", ["--version"], { timeout: 10_000 });
      gitVersion = stdout.trim();
    } catch (err) {
      gitError = (err as Error).message;
    }
    const gitAgentModulePath = path.resolve(
      process.cwd(),
      "node_modules",
      "@open-gitagent",
      "gitagent",
      "dist",
      "exports.js",
    );
    reply.send({
      cwd: process.cwd(),
      git: { available: gitVersion !== null, version: gitVersion, error: gitError },
      gitAgentModule: { path: gitAgentModulePath, exists: existsSync(gitAgentModulePath) },
      repoContextProvider: fastify.ctx.repoContextProvider.name,
      hasGithubToken: Boolean(fastify.ctx.env.GITHUB_TOKEN),
    });
  });

  fastify.get("/health", async (_request, reply) => {
    let dbConnected = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbConnected = false;
    }

    reply.send({
      status: dbConnected ? "ok" : "degraded",
      uptimeSeconds: Math.round(process.uptime()),
      dbConnected,
      llmProvider: fastify.ctx.llmProvider.name,
      llmModel: fastify.ctx.env.LLM_PROVIDER === "featherless" ? fastify.ctx.env.FEATHERLESS_MODEL ?? "(default)" : undefined,
      embeddingsProvider: fastify.ctx.embeddingsProvider.name,
      safetyProvider: fastify.ctx.safetyAdapter.name,
    });
  });
}
