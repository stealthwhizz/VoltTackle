import type { DeployMetadata, DeploymentProvider, RecentDeploysRequest } from "./types.js";

export interface GithubProviderConfig {
  token: string;
  repo: string;
  baseUrl?: string;
}

interface GithubCommit {
  sha: string;
  commit: { author: { name: string; date: string }; message: string };
}

/**
 * Real GitHub adapter — lists recent commits on the default branch via the
 * REST API as a proxy for recent deploys (works without a separate CD
 * system; swap for the Deployments API if the team uses it).
 */
export class GithubDeploymentProvider implements DeploymentProvider {
  readonly name = "github" as const;
  private readonly baseUrl: string;

  constructor(private readonly config: GithubProviderConfig) {
    this.baseUrl = config.baseUrl ?? "https://api.github.com";
  }

  async getRecentDeploys(request: RecentDeploysRequest): Promise<DeployMetadata[]> {
    const since = new Date(Date.now() - request.sinceMinutes * 60_000).toISOString();
    const response = await fetch(
      `${this.baseUrl}/repos/${this.config.repo}/commits?since=${encodeURIComponent(since)}&per_page=10`,
      {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub commits query failed: ${response.status} ${await response.text()}`);
    }

    const commits = (await response.json()) as GithubCommit[];
    return commits.map((commit) => ({
      sha: commit.sha.slice(0, 7),
      author: commit.commit.author.name,
      message: commit.commit.message.split("\n")[0] ?? commit.commit.message,
      deployedAt: commit.commit.author.date,
    }));
  }
}
