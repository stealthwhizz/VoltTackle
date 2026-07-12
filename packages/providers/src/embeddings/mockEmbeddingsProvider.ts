import type { EmbeddingsProvider } from "./types.js";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was",
  "were", "be", "been", "with", "at", "by", "from", "this", "that", "it", "as", "into",
]);

/**
 * Deterministic, offline embeddings adapter using the "hashing trick"
 * (feature hashing / random projection over tokens, à la Vowpal Wabbit /
 * sklearn's HashingVectorizer) rather than hashing the whole string. Texts
 * sharing vocabulary land close together in cosine space, so Qdrant
 * nearest-neighbor search behaves meaningfully offline — unlike hashing the
 * full text, which would produce uncorrelated vectors for similar inputs.
 */
export class MockEmbeddingsProvider implements EmbeddingsProvider {
  readonly name = "mock" as const;
  readonly dimensions: number;

  constructor(dimensions = 384) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const vector = new Array(this.dimensions).fill(0) as number[];
    const tokens = tokenize(text);

    for (const token of tokens) {
      const { bucket, sign } = hashToken(token, this.dimensions);
      vector[bucket] = (vector[bucket] ?? 0) + sign;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / magnitude);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function hashToken(token: string, dimensions: number): { bucket: number; sign: number } {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return {
    bucket: unsigned % dimensions,
    sign: (unsigned & 1) === 0 ? 1 : -1,
  };
}
