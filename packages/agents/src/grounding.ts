/**
 * Enforces the "grounded, not fabricated" rule shared by the Root Cause and
 * Remediation agents: keep only the references the model cited that were
 * genuinely present in the retrieved/available context. If the model cited none
 * of the real references, fall back to the top-N real references rather than
 * surfacing an empty (or hallucinated) grounding.
 *
 * Behavior is identical to the inline logic it replaces, extracted so it can be
 * unit-tested in isolation.
 */
export function filterGroundedReferences(
  candidates: string[],
  validReferences: string[],
  fallbackLimit = 3,
): string[] {
  const valid = new Set(validReferences);
  const cited = candidates.filter((ref) => valid.has(ref));
  return cited.length > 0 ? cited : validReferences.slice(0, fallbackLimit);
}
