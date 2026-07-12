import type { DeploymentProvider, DeploymentProviderName } from "./types.js";
import { MockDeploymentProvider } from "./mockDeploymentProvider.js";
import { GithubDeploymentProvider } from "./githubProvider.js";

export * from "./types.js";
export { MockDeploymentProvider } from "./mockDeploymentProvider.js";
export { GithubDeploymentProvider } from "./githubProvider.js";

export interface DeploymentProviderFactoryConfig {
  provider: DeploymentProviderName;
  githubToken?: string;
  githubRepo?: string;
}

export function createDeploymentProvider(config: DeploymentProviderFactoryConfig): DeploymentProvider {
  if (config.provider === "github" && config.githubToken && config.githubRepo) {
    return new GithubDeploymentProvider({ token: config.githubToken, repo: config.githubRepo });
  }
  return new MockDeploymentProvider();
}
