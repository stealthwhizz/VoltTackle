import { z } from "zod";

/**
 * Generic, schema-driven fake-data generator used by MockLlmProvider so that
 * every agent gets schema-valid, context-aware output without needing a real
 * OpenAI/Anthropic API key. It never needs to know about individual agent
 * semantics: enum fields are picked by keyword overlap against the prompt
 * text, string fields fall back to field-name-aware canned phrasing, and
 * everything else derives from the zod schema's own constraints.
 */

const FIELD_TEXT_HINTS: Record<string, (ctx: FakerContext) => string> = {
  reasoning: (ctx) =>
    `Classified from alert signal keywords in "${truncate(ctx.contextText, 120)}" combined with recent deploy activity.`,
  signals: (ctx) => extractKeywordSignal(ctx.contextText, ctx.arrayIndex ?? 0),
  summary: (ctx) => `Mock-generated summary grounded in retrieved context for: ${truncate(ctx.contextText, 100)}.`,
  hypothesis: (ctx) =>
    `Based on retrieved runbooks and service docs, the most likely cause relates to ${dominantTopic(ctx.contextText)}.`,
  rootcause: (ctx) => `Root cause traced to ${dominantTopic(ctx.contextText)} based on grounded retrieval context.`,
  rationale: () => "Mock safety evaluation found no destructive commands, PII, or policy violations in the proposed steps.",
  rollbackguidance: () => "Revert via standard CI/CD rollback to the previous stable deployment; no manual data changes required.",
  description: (ctx) => actionStepPhrase(ctx.arrayIndex ?? 0, dominantTopic(ctx.contextText)),
  title: (ctx) => `Postmortem: ${firstLineWithoutLabel(ctx.contextText, 70)}`,
  impact: () => "Estimated moderate customer impact during the incident window; exact scope pending metrics review.",
};

interface FakerContext {
  contextText: string;
  fieldName?: string;
  arrayIndex?: number;
}

export function fakeFromSchema(schema: z.ZodTypeAny, ctx: FakerContext): unknown {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodObject": {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(shape)) {
        result[key] = fakeFromSchema(value as z.ZodTypeAny, { ...ctx, fieldName: key });
      }
      return result;
    }
    case "ZodArray": {
      const inner = def.type as z.ZodTypeAny;
      const count = pickArrayLength(ctx.fieldName);
      return Array.from({ length: count }, (_, i) => fakeFromSchema(inner, { ...ctx, arrayIndex: i }));
    }
    case "ZodEnum": {
      const values = def.values as string[];
      return pickByKeywordOverlap(values, ctx.contextText);
    }
    case "ZodNativeEnum": {
      const values = Object.values(def.values as Record<string, string>);
      return pickByKeywordOverlap(values, ctx.contextText);
    }
    case "ZodString": {
      return fakeString(schema as z.ZodString, ctx);
    }
    case "ZodNumber": {
      return fakeNumber(schema as z.ZodNumber, ctx);
    }
    case "ZodBoolean": {
      return /detected|leak|unsafe|violation/i.test(ctx.fieldName ?? "") ? false : true;
    }
    case "ZodRecord": {
      return {};
    }
    case "ZodNullable": {
      const inner = def.innerType as z.ZodTypeAny;
      // A real model leaves optional metadata (e.g. a postmortem action item's
      // `owner`) null when it can't infer it, rather than inventing filler.
      // Mirror that: null out hint-less nullable string fields instead of
      // emitting "Mock output for owner...".
      const innerName = (inner as unknown as { _def: { typeName?: string } })._def.typeName;
      const normalizedField = (ctx.fieldName ?? "").toLowerCase().replace(/\[.*\]$/, "");
      if (innerName === "ZodString" && !(normalizedField in FIELD_TEXT_HINTS)) {
        return null;
      }
      return fakeFromSchema(inner, ctx);
    }
    case "ZodOptional": {
      return fakeFromSchema(def.innerType as z.ZodTypeAny, ctx);
    }
    case "ZodDefault": {
      return fakeFromSchema(def.innerType as z.ZodTypeAny, ctx);
    }
    case "ZodLiteral": {
      return def.value;
    }
    case "ZodUnion": {
      const options = def.options as z.ZodTypeAny[];
      return fakeFromSchema(options[0] as z.ZodTypeAny, ctx);
    }
    default:
      return null;
  }
}

function pickArrayLength(fieldName?: string): number {
  if (!fieldName) return 2;
  if (/step/i.test(fieldName)) return 3;
  if (/reference|evidence|factor|signal/i.test(fieldName)) return 2;
  return 2;
}

function fakeString(schema: z.ZodString, ctx: FakerContext): string {
  const checks = (schema._def.checks ?? []) as Array<{ kind: string }>;
  if (checks.some((c) => c.kind === "datetime")) {
    return new Date().toISOString();
  }
  if (checks.some((c) => c.kind === "uuid")) {
    return crypto.randomUUID();
  }
  if (checks.some((c) => c.kind === "email")) {
    return "oncall.engineer@volttackle.dev";
  }

  const normalizedField = (ctx.fieldName ?? "").toLowerCase().replace(/\[.*\]$/, "");
  const hint = FIELD_TEXT_HINTS[normalizedField];
  if (hint) return hint(ctx);

  return `Mock output for "${normalizedField || "field"}" grounded in: ${truncate(ctx.contextText, 80)}`;
}

function fakeNumber(schema: z.ZodNumber, ctx: FakerContext): number {
  const fieldName = (ctx.fieldName ?? "").toLowerCase();
  if (fieldName === "order" && ctx.arrayIndex !== undefined) {
    return ctx.arrayIndex + 1;
  }

  const checks = (schema._def.checks ?? []) as Array<{ kind: string; value?: number }>;
  const min = checks.find((c) => c.kind === "min")?.value ?? 0;
  const max = checks.find((c) => c.kind === "max")?.value ?? (min <= 1 ? 1 : 100);
  const isInt = checks.some((c) => c.kind === "int");

  let ratio = 0.7;
  if (/confidence|score/.test(fieldName)) ratio = 0.62 + hashRatio(ctx.contextText) * 0.25;

  const value = min + (max - min) * ratio;
  return isInt ? Math.round(value) : Math.round(value * 100) / 100;
}

function pickByKeywordOverlap(values: string[], contextText: string): string {
  const lowerContext = contextText.toLowerCase();
  let best = values[0] ?? "";
  let bestScore = -1;
  for (const value of values) {
    const words = value.toLowerCase().split(/[_\s]+/).filter(Boolean);
    const score = words.reduce((acc, word) => acc + (lowerContext.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = value;
    }
  }
  return best;
}

// Checked before the fuzzy regexes below: agent prompts that already know
// the incident's category (RCA, remediation) always include the literal
// enum token (e.g. "Category: SUSPICIOUS_TRAFFIC"). Matching that exactly
// is far more reliable than fuzzy keyword search, which gets thrown off by
// boilerplate prompt text — e.g. every prompt has a "Recent deploys:"
// section header, which would otherwise always win a fuzzy "deploy" match
// regardless of what the incident is actually about.
const CATEGORY_TOKEN_TOPICS: Record<string, string> = {
  DEPLOY_REGRESSION: "a recent deployment change",
  INFRA_FAILURE: "cluster infrastructure pressure",
  DEPENDENCY_OUTAGE: "a third-party or downstream dependency outage",
  SUSPICIOUS_TRAFFIC: "anomalous/suspicious traffic patterns",
};

function dominantTopic(contextText: string): string {
  for (const [token, label] of Object.entries(CATEGORY_TOKEN_TOPICS)) {
    if (contextText.includes(token)) return label;
  }

  const topics: Array<[RegExp, string]> = [
    [/connection pool|database|db |postgres/i, "database connection pool exhaustion"],
    [/payment|processor|checkout/i, "a third-party payment dependency"],
    [/traffic|login|credential|rate.?limit/i, "anomalous/suspicious traffic patterns"],
    [/node|kubernetes|pod|cluster|memory pressure/i, "cluster infrastructure pressure"],
    [/deploy|rollout|canary|migration/i, "a recent deployment change"],
  ];
  for (const [pattern, label] of topics) {
    if (pattern.test(contextText)) return label;
  }
  return "the most semantically similar retrieved incident";
}

function actionStepPhrase(index: number, topic: string): string {
  const templates = [
    (t: string) => `Confirm the incident scope and current impact related to ${t}.`,
    (t: string) => `Apply the closest-matching runbook mitigation for ${t}.`,
    (t: string) => `Verify recovery and monitor for regression before closing out.`,
  ];
  const template = templates[index % templates.length] as (t: string) => string;
  return template(topic);
}

function extractKeywordSignal(contextText: string, index: number): string {
  const words = contextText
    .replace(/[^a-zA-Z0-9%._\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 5 && !/^(alert|volttackle|tackle|incident)/i.test(w));
  const windowed = words.slice(index * 2, index * 2 + 2);
  return windowed.join(", ") || words.slice(0, 2).join(", ") || "no strong signal extracted";
}

function hashRatio(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

/** Pulls the first meaningful line of the prompt, stripping a leading
 *  "Incident:"/"Category:" style label so mock titles don't double up. */
function firstLineWithoutLabel(text: string, length: number): string {
  const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? text;
  const stripped = firstLine.replace(/^\s*(incident|category|alert|summary)\s*:\s*/i, "").trim();
  return truncate(stripped, length);
}
