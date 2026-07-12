import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(__dirname, "../prompts");

export interface LoadedPrompt {
  agentName: string;
  versionId: string;
  content: string;
}

const cache = new Map<string, LoadedPrompt>();

/**
 * Loads a versioned prompt template from packages/agents/prompts, matching
 * the "<agentName>.<versionId>.md" filename convention that the database
 * package's seedPromptVersions() also reads. Cached per process — prompt
 * files are static within a running instance.
 */
export function loadPrompt(agentName: string, versionId = "v1"): LoadedPrompt {
  const key = `${agentName}.${versionId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const filePath = path.join(PROMPTS_DIR, `${key}.md`);
  const content = readFileSync(filePath, "utf-8").trim();

  const prompt: LoadedPrompt = { agentName, versionId, content };
  cache.set(key, prompt);
  return prompt;
}
