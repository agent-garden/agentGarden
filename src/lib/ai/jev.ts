import 'server-only';

/**
 * Jev by TypeSafe AI ("System One"): answers typed questions about some
 * content with probabilities instead of free text.
 * Docs: https://docs.typesafe.ai/api  ·  Key: the TYPESAFE_API_KEY App Hosting secret.
 */

const ENDPOINT = process.env.JEV_ENDPOINT || 'https://api.typesafe.ai/v1/systemone';
export const JEV_MODEL = process.env.JEV_MODEL || 'jev-latest';

export type JevQuestion =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'score'; instructions: string; criteria: string[] };

export type JevAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'score'; score: number; confidence: number; legend: Record<string, string>; probabilities: Record<string, number> };

export function jevConfigured(): boolean {
  return !!process.env.TYPESAFE_API_KEY;
}

export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {}
): Promise<Record<string, JevAnswer>> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error('TYPESAFE_API_KEY is not set');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: JEV_MODEL, state, questions }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Jev request failed (${res.status}): ${detail}`);
  }
  const body = await res.json();
  if (!body?.answers) throw new Error('Jev returned no answers');
  return body.answers as Record<string, JevAnswer>;
}

/** Probability (0..1) from a yes/no answer, or null if missing. */
export function noulOf(answer: JevAnswer | undefined): number | null {
  return answer && answer.type === 'noul' && typeof answer.noul === 'number' ? answer.noul : null;
}
