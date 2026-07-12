import { describe, it, expect } from "vitest";
import { MockEmbeddingsProvider } from "./mockEmbeddingsProvider.js";

const provider = new MockEmbeddingsProvider();

function cosine(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

describe("MockEmbeddingsProvider (offline retrieval sanity)", () => {
  it("produces a unit-normalized vector of the declared dimension", async () => {
    const v = await provider.embed("checkout-api 5xx error rate spiked after the v2.14 deploy");
    expect(v).toHaveLength(provider.dimensions);
    const magnitude = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it("is deterministic — the same text yields the same vector", async () => {
    const a = await provider.embed("database connection pool exhausted");
    const b = await provider.embed("database connection pool exhausted");
    expect(a).toEqual(b);
  });

  it("gives a self-similarity of ~1", async () => {
    const v = await provider.embed("payment processor timeout cascade");
    expect(cosine(v, v)).toBeCloseTo(1, 5);
  });

  it("ranks vocabulary-sharing text higher than unrelated text (semantic discrimination)", async () => {
    const query = await provider.embed(
      "checkout-api 5xx error rate spiked after the latest deploy; schema migration suspected",
    );
    const similar = await provider.embed(
      "Runbook: rolling back a bad deploy. checkout-api deploy rollback, error rate baseline",
    );
    const unrelated = await provider.embed(
      "Suspicious traffic: credential stuffing on auth-service, WAF rate-limit rules",
    );
    const simScore = cosine(query, similar);
    const unrelatedScore = cosine(query, unrelated);
    expect(simScore).toBeGreaterThan(unrelatedScore);
  });

  it("embedBatch matches per-item embed", async () => {
    const texts = ["infra failure kubernetes node pressure", "dependency outage third-party API"];
    const batch = await provider.embedBatch(texts);
    const one = await provider.embed(texts[0] as string);
    expect(batch[0]).toEqual(one);
  });
});
