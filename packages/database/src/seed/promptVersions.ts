import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(__dirname, "../../../agents/prompts");

/**
 * Registers every prompt template file found in packages/agents/prompts as a
 * PromptVersion row, keyed by "<agentName>.<versionId>.md" filename convention.
 * Safe to run before those files exist (Phase 3) — it just registers nothing.
 */
export async function seedPromptVersions(prisma: PrismaClient) {
  if (!existsSync(PROMPTS_DIR)) return [];

  const files = readdirSync(PROMPTS_DIR).filter((f) => f.endsWith(".md"));
  const created = [];

  for (const file of files) {
    const match = file.match(/^(?<agentName>[a-z0-9-]+)\.(?<versionId>v\d+(?:\.\d+)*)\.md$/);
    if (!match?.groups) continue;

    const agentName: string | undefined = match.groups.agentName;
    const versionId: string | undefined = match.groups.versionId;
    if (!agentName || !versionId) continue;
    const filePath = path.join(PROMPTS_DIR, file);
    const content = readFileSync(filePath, "utf-8");
    const checksum = createHash("sha256").update(content).digest("hex").slice(0, 16);

    const record = await prisma.promptVersion.upsert({
      where: { agentName_versionId: { agentName, versionId } },
      update: { filePath: `packages/agents/prompts/${file}`, checksum },
      create: { agentName, versionId, filePath: `packages/agents/prompts/${file}`, checksum },
    });
    created.push(record);
  }

  return created;
}
