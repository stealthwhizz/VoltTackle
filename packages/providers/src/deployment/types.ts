export type DeploymentProviderName = "github" | "gitlab" | "mock";

export interface DeployMetadata {
  sha: string;
  author: string;
  message: string;
  deployedAt: string;
}

export interface RecentDeploysRequest {
  service: string;
  sinceMinutes: number;
}

export interface DeploymentProvider {
  readonly name: DeploymentProviderName;
  getRecentDeploys(request: RecentDeploysRequest): Promise<DeployMetadata[]>;
}
