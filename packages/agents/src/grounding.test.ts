import { describe, it, expect } from "vitest";
import { filterGroundedReferences } from "./grounding.js";

describe("filterGroundedReferences (RCA/remediation grounding)", () => {
  it("keeps only cited references that exist in the valid set", () => {
    const cited = ["runbook:A", "hallucinated:X", "incident:B"];
    const valid = ["runbook:A", "incident:B", "doc:C"];
    expect(filterGroundedReferences(cited, valid)).toEqual(["runbook:A", "incident:B"]);
  });

  it("drops a fully hallucinated citation and falls back to the top-N real refs", () => {
    const cited = ["totally:made-up"];
    const valid = ["ref:1", "ref:2", "ref:3", "ref:4"];
    // none cited are valid -> fallback to first 3 real refs
    expect(filterGroundedReferences(cited, valid)).toEqual(["ref:1", "ref:2", "ref:3"]);
  });

  it("returns an empty array when the model cited nothing and there is no context", () => {
    expect(filterGroundedReferences([], [])).toEqual([]);
  });

  it("never surfaces a reference that was not in the valid set", () => {
    const cited = ["a", "b", "c"];
    const valid = ["a"];
    const result = filterGroundedReferences(cited, valid);
    expect(result.every((r) => valid.includes(r))).toBe(true);
    expect(result).toEqual(["a"]);
  });

  it("respects a custom fallback limit", () => {
    const valid = ["r1", "r2", "r3", "r4", "r5"];
    expect(filterGroundedReferences(["none"], valid, 2)).toEqual(["r1", "r2"]);
  });

  it("preserves the order of the cited references", () => {
    const cited = ["incident:B", "runbook:A"];
    const valid = ["runbook:A", "incident:B"];
    expect(filterGroundedReferences(cited, valid)).toEqual(["incident:B", "runbook:A"]);
  });
});
