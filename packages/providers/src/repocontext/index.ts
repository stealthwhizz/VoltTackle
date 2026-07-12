import type { RepoContext, RepoContextRequest } from "@volt-tackle/shared";
import type { RepoContextProvider } from "./types.js";
import { emptyRepoContext } from "./types.js";
import { MockRepoContextProvider } from "./mockRepoContextProvider.js";
import { LocalGitRepoContextProvider } from "./localGitRepoContextProvider.js";
import { GitAgentRepoContextProvider } from "./gitAgentRepoContextProvider.js";

export * from "./types.js";
export { MockRepoContextProvider } from "./mockRepoContextProvider.js";
export { LocalGitRepoContextProvider } from "./localGitRepoContextProvider.js";
export { GitAgentRepoContextProvider } from "./gitAgentRepoContextProvider.js";

/** No-op provider used when REPO_CONTEXT_PROVIDER=none — keeps the pipeline
 *  identical to its pre-GitAgent behavior. */
class NoneRepoContextProvider implements RepoContextProvider {
  readonly name = "none" as const;
  async getRepoContext(_request: RepoContextRequest): Promise<RepoContext> {
    return emptyRepoContext("none");
  }
}

export interface RepoContextFactoryConfig {
  provider: RepoContext["provider"];
  repoMap?: Record<string, string>;
  githubToken?: string;
  logger?: { warn: (entry: unknown, msg?: string) => void };
  gitAgentBin?: string;
  gitAgentLlmApiKey?: string;
  gitAgentModel?: string;
  gitAgentOpenAiBaseUrl?: string;
}

export function createRepoContextProvider(config: RepoContextFactoryConfig): RepoContextProvider {
  const repoMap = config.repoMap ?? {};

  switch (config.provider) {
    case "gitagent":
      return new GitAgentRepoContextProvider({
        repoMap,
        logger: config.logger,
        pat: config.githubToken,
        llmApiKey: config.gitAgentLlmApiKey,
        model: config.gitAgentModel,
        openaiBaseUrl: config.gitAgentOpenAiBaseUrl,
        fallback: new LocalGitRepoContextProvider({ repoMap, token: config.githubToken }),
      });
    case "local-git":
      return new LocalGitRepoContextProvider({ repoMap, token: config.githubToken });
    case "mock":
      return new MockRepoContextProvider();
    default:
      return new NoneRepoContextProvider();
  }
}
