import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return {
    ...actual,
    execFile: execFileMock,
  };
});

import { GitAgentRepoContextProvider } from "./gitAgentRepoContextProvider.js";

describe("GitAgentRepoContextProvider", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("logs the underlying clone failure and falls back when git is unavailable", async () => {
    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: unknown, callback: (error: Error | null, stdout?: string, stderr?: string) => void) => {
        callback(new Error("spawn git ENOENT"));
        return {} as never;
      },
    );

    const logger = { warn: vi.fn() };
    const fallback = {
      getRepoContext: vi.fn().mockResolvedValue({
        available: true,
        provider: "local-git",
        repo: "https://github.com/example/repo",
        ref: null,
        recentCommits: [],
        changedFiles: [],
        suspectSignals: [],
        investigation: [],
        summary: "local git fallback",
      }),
    };

    const provider = new GitAgentRepoContextProvider({
      repoMap: {},
      pat: "token",
      llmApiKey: "key",
      model: "openai:gpt-4o-mini",
      fallback: fallback as never,
      logger: logger as never,
    });

    const result = await provider.getRepoContext({
      service: "api",
      incidentSummary: "Repo analysis test",
      category: "deploy",
      sinceMinutes: 60,
      repoUrl: "https://github.com/example/repo",
    });

    expect(logger.warn).toHaveBeenCalled();
    expect(fallback.getRepoContext).toHaveBeenCalled();
    expect(result.provider).toBe("local-git");
    expect(result.summary).toContain("spawn git ENOENT");
  });
});
