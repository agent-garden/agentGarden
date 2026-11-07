import 'server-only';
import { GoogleGenAI } from '@google/genai';

/**
 * Gemini, called directly through Google's SDK (no Genkit).
 * AgentGarden only uses it for embeddings: search fingerprints for agents,
 * queries and memory nodes. All three must come from the same model.
 *
 * Key: the GEMINI_API_KEY App Hosting secret.
 */

// text-embedding-004 was shut down on the Gemini API on 2026-01-14.
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;

let client: GoogleGenAI | null = null;

export function geminiConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return (client ??= new GoogleGenAI({ apiKey }));
}

/** 768-dim, unit-length embedding (Gemini only pre-normalizes 3072-dim output). */
export async function embedText(text: string): Promise<number[]> {
  const response = await gemini().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text.slice(0, 8000),
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) throw new Error('Gemini returned no embedding');
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}
