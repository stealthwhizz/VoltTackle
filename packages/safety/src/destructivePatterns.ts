/**
 * Keyword/pattern bank for detecting destructive commands and secret/PII
 * leaks in agent-generated remediation text. Shared between the mock
 * adapter's heuristic scan and the real Enkrypt adapter's keyword_detector
 * configuration.
 */
export const DESTRUCTIVE_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\bdrop\s+(table|database|schema)\b/i,
  /\bdelete\s+from\s+\w+\s*;?\s*$/im,
  /\btruncate\s+table\b/i,
  /\bformat\s+[a-z]:/i,
  /\bkill\s+-9\s+1\b/i,
  /\bchmod\s+777\b/i,
  /\bdisable\s+(auth|authentication|firewall|waf)\b/i,
  /\bforce\s*[- ]?push\b.*\b(main|master)\b/i,
  /\bshutdown\s+-h\s+now\b/i,
  /\bdelete\s+all\s+(instances|pods|nodes|users)\b/i,
];

export const SECRET_OR_PII_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9_-]{20,}\.(?:[A-Za-z0-9_-]{6,}\.)?[A-Za-z0-9_-]{20,}\b/, // long token-like strings
  /\bsk-[A-Za-z0-9]{20,}\b/, // API-key-shaped secrets
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // credit-card-shaped numbers
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-shaped numbers
];

export function findMatches(patterns: RegExp[], text: string): string[] {
  const matches: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) matches.push(match[0]);
  }
  return matches;
}
