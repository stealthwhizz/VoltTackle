# Repo Context Layer (GitAgent) — how to run & test

An **optional, additive** capability: for deploy-related incidents, Volt Tackle
can pull repository context (recent commits, changed files, suspect changes)
and feed it into the Root Cause Agent. Default is **off** — nothing changes
unless you opt in.

See [ADR 0009](adr/0009-gitagent-repo-context.md) for the design rationale.

## Providers

Set `REPO_CONTEXT_PROVIDER` in `apps/api/.env`:

| Value | What it does | Needs |
|-------|--------------|-------|
| `none` (default) | no repo analysis; RCA behaves exactly as before | — |
| `mock` | deterministic offline repo context | nothing |
| `local-git` | **real** `git` shallow-clone/inspect of the mapped repo (no LLM) | `git` on PATH |
| `gitagent` | **real** `@open-gitagent/gitagent` CLI; falls back to `local-git` if the CLI is absent | `gitagent` installed + an LLM key + PAT for private repos |

Map services to repositories with `INCIDENT_REPO_MAP` (JSON). Values may be a
remote URL **or a local path** (great for offline testing):

```bash
# analyze a local checkout (no network) — points at THIS repo as a demo
INCIDENT_REPO_MAP={"checkout-api":"C:/Users/you/GitHub/Hackathon/VoltTackle"}

# or a remote (shallow-cloned into an isolated temp dir, then cleaned up)
INCIDENT_REPO_MAP={"checkout-api":"https://github.com/acme/checkout-api"}
```

Repo context is only fetched for `DEPLOY_REGRESSION` incidents.

## Quick test — mock path (no git, no network)

```bash
# apps/api/.env
REPO_CONTEXT_PROVIDER=mock

# restart the API, then send a deploy-regression alert:
curl -X POST http://localhost:4000/api/webhooks/alerts -H "Content-Type: application/json" -d '{
  "source":"datadog","externalId":"repo-test-1","alertName":"5xx spike","service":"checkout-api",
  "severity":"SEV2","message":"checkout-api 5xx spiked right after the latest deploy; schema migration suspected",
  "tags":["checkout-api","deploy"]}'
```

Open the incident: a **`REPO_CONTEXT_FETCHED`** event appears in the timeline,
and the root-cause hypothesis can now reference specific commits.

## Quick test — local-git path (real git, offline)

Point a service at any local git checkout (the Volt Tackle repo itself works):

```bash
# apps/api/.env
REPO_CONTEXT_PROVIDER=local-git
INCIDENT_REPO_MAP={"checkout-api":"C:/Users/you/GitHub/Hackathon/VoltTackle"}
```

Restart the API and send the same alert. The `REPO_CONTEXT_FETCHED` event will
show **real commit SHAs and changed files** from that repository, and any
commit whose message/files overlap the incident text is flagged as a suspect.

## Real GitAgent path

```bash
npm install -g @open-gitagent/gitagent   # provides the `gitagent` CLI

# apps/api/.env
REPO_CONTEXT_PROVIDER=gitagent
INCIDENT_REPO_MAP={"checkout-api":"https://github.com/acme/checkout-api"}
GITHUB_TOKEN=ghp_...            # PAT for private repos (reused as --pat)
GITAGENT_LLM_API_KEY=sk-...     # key for gitagent's own agent loop
GITAGENT_MODEL=openai:gpt-4o
```

If the `gitagent` CLI is not installed or errors, the provider **automatically
falls back to `local-git`** and annotates the summary — it never breaks the
pipeline.

### Featherless with GitAgent

Volt Tackle's own RCA runs on **Featherless** and consumes the repo facts
GitAgent produces — that's the integration boundary. Driving *GitAgent's own*
loop with Featherless is not officially supported (GitAgent doesn't document a
custom OpenAI base URL). An experimental passthrough exists:

```bash
GITAGENT_OPENAI_BASE_URL=https://api.featherless.ai/v1
GITAGENT_LLM_API_KEY=<featherless-key>
GITAGENT_MODEL=openai:Qwen/Qwen2.5-7B-Instruct
```

This sets `OPENAI_BASE_URL` for the gitagent subprocess. Treat as **unverified**
until GitAgent documents base-URL support (see ADR 0009).

## What's real vs mocked

- `local-git` and `gitagent` do **real** git operations. `mock` is deterministic.
- The repo sandbox for remote clones is an isolated temp dir, always removed
  after extraction.
- The RCA reasoning over the repo context always runs on the configured Volt
  Tackle LLM (Featherless by default) — unchanged.
