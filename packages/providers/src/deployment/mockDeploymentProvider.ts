import type { DeployMetadata, DeploymentProvider, RecentDeploysRequest } from "./types.js";

const AUTHORS = ["alex.chen", "priya.nair", "marcus.idowu", "sam.reyes", "jordan.lee"];

/**
 * Deterministic offline deployment metadata adapter. Returns a small,
 * plausible list of recent deploys for the requested service.
 */
export class MockDeploymentProvider implements DeploymentProvider {
  readonly name = "mock" as const;

  async getRecentDeploys(request: RecentDeploysRequest): Promise<DeployMetadata[]> {
    const seed = hashString(request.service);
    const count = 1 + (seed % 3);
    const now = Date.now();

    return Array.from({ length: count }, (_, i) => {
      const minutesAgo = 5 + i * 17 + (seed % 10);
      return {
        sha: hashString(`${request.service}-${i}`).toString(16).padStart(7, "0").slice(0, 7),
        author: AUTHORS[(seed + i) % AUTHORS.length] as string,
        message: deployMessage(request.service, i),
        deployedAt: new Date(now - minutesAgo * 60_000).toISOString(),
      };
    });
  }
}

function deployMessage(service: string, index: number): string {
  const messages = [
    `feat(${service}): add retry logic for downstream calls`,
    `fix(${service}): correct pagination edge case`,
    `chore(${service}): bump dependency versions`,
    `refactor(${service}): simplify request validation`,
  ];
  return messages[index % messages.length] as string;
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}
