'use server';

/**
 * @fileOverview Reputation-weighted semantic agent search.
 *
 * 1. Embed the query with Gemini (same model that embeds each agent's
 *    `search_text` into `search_embedding` at registration).
 * 2. Firestore `findNearest` over `agents.search_embedding` (COSINE, top 50).
 * 3. Re-rank: similarity * (log10(verified_task_count + 1) + 1).
 * 4. Final relevance check by Jev (TypeSafe) over the top 15: one yes/no
 *    question per candidate ("does this agent genuinely match?").
 *
 * Without keys, or once today's AI budget is used up, search still works:
 * it falls back to active agents sorted by verified work.
 */

import { z } from 'zod';
import { initializeAdmin } from '@/firebase/admin';
import { enforceSearchRateLimit, takeAiBudget } from '@/lib/search-guard';
import { embedText, geminiConfigured } from '@/lib/ai/gemini';
import { askJev, jevConfigured, noulOf, type JevQuestion } from '@/lib/ai/jev';

const PerformAgentVectorSearchInputSchema = z.object({
  query: z.string(),
  location: z.string().optional(),
  timezone: z.string().optional(),
});
export type PerformAgentVectorSearchInput = z.infer<typeof PerformAgentVectorSearchInputSchema>;

const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  introduction: z.string(),
  specialties: z.array(z.string()),
  stack: z.string(),
  verified: z.boolean(),
  trust_level: z.number().optional(),
  reputation: z.number().optional(),
  verified_task_count: z.number().optional(),
  review_count: z.number().optional(),
  public_key: z.string(),
  availability: z.string(),
  security_status: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  supports_x402: z.boolean().optional(),
  base_fee_cents: z.number().optional(),
  last_heartbeat: z.number().optional(),
});
export type PerformAgentVectorSearchOutput = z.infer<typeof AgentSchema>[];

const VECTOR_POOL = 50;
const RERANK_POOL = 15;
const MAX_QUERY_LENGTH = 500;
/** Candidates Jev rates below this are dropped (unless that would drop everyone). */
const MATCH_THRESHOLD = 0.35;

type Candidate = { id: string; data: any; score: number };

function toNumberTimestamp(value: any): number | undefined {
  if (!value) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function toPublicAgent(id: string, a: any): z.infer<typeof AgentSchema> {
  return {
    id,
    name: a.name || 'Unknown Agent',
    handle: a.handle || '@unknown',
    introduction: a.introduction || '',
    specialties: Array.isArray(a.specialties) ? a.specialties : [],
    stack: a.stack || 'Unknown',
    verified: !!a.verified,
    trust_level: a.trust_level ?? 0,
    reputation: a.reputation ?? 0,
    verified_task_count: a.verified_task_count ?? 0,
    review_count: a.review_count ?? 0,
    public_key: a.public_key || '',
    availability: a.availability || 'Active',
    security_status: a.security_status || 'unverified',
    location: a.location || undefined,
    timezone: a.timezone || undefined,
    supports_x402: a.supports_x402 ?? false,
    base_fee_cents: a.base_fee_cents ?? 0,
    last_heartbeat: toNumberTimestamp(a.last_heartbeat),
  };
}

/** Jev relevance check: keeps genuine matches, most likely first. */
async function rerankWithJev(query: string, top: Candidate[]): Promise<Candidate[]> {
  const questions: Record<string, JevQuestion> = {};
  top.forEach((c, i) => {
    questions[`match_${i}`] = {
      type: 'noul',
      instructions: `Does candidate #${i} ("${String(c.data.name || '').slice(0, 80)}") genuinely have the skills the searcher is asking for?`,
    };
  });
  const answers = await askJev(
    {
      searcher_request: query,
      candidates: top.map((c, i) => ({
        number: i,
        name: c.data.name,
        introduction: String(c.data.introduction || '').slice(0, 400),
        specialties: (c.data.specialties || []).slice(0, 12),
        verified_jobs: c.data.verified_task_count || 0,
      })),
    },
    questions
  );
  const rated = top.map((c, i) => ({ c, p: noulOf(answers[`match_${i}`]) ?? 0 }));
  const kept = rated.filter((r) => r.p >= MATCH_THRESHOLD);
  if (kept.length === 0) return top;
  // Relevance first, then the reputation-weighted score for ties.
  return kept.sort((a, b) => b.p - a.p || b.c.score - a.c.score).map((r) => r.c);
}

export async function performAgentVectorSearch(
  input: PerformAgentVectorSearchInput
): Promise<PerformAgentVectorSearchOutput> {
  await enforceSearchRateLimit();
  const { query, location, timezone } = PerformAgentVectorSearchInputSchema.parse(input);
  const queryText = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (!queryText) return [];

  const { db } = initializeAdmin();
  const agentsRef = db.collection('agents');
  let candidates: Candidate[] = [];

  // 1-2. Semantic retrieval (skipped without a key or once today's budget is used)
  try {
    if (!geminiConfigured()) throw new Error('Gemini not configured');
    if (!(await takeAiBudget('embed'))) throw new Error('Daily embedding budget reached');
    const vector = await embedText(queryText);
    const snapshot = await agentsRef
      .findNearest({
        vectorField: 'search_embedding',
        queryVector: vector,
        distanceMeasure: 'COSINE',
        limit: VECTOR_POOL,
        distanceResultField: '_distance',
      })
      .get();
    candidates = snapshot.docs
      .filter((d) => d.data().status === 'active')
      .map((d) => {
        const data = d.data();
        const distance = typeof data._distance === 'number' ? data._distance : 1;
        const similarity = 1 - distance / 2; // COSINE distance 0..2 -> similarity 1..0
        const reputationWeight = Math.log10((data.verified_task_count || 0) + 1) + 1;
        return { id: d.id, data, score: similarity * reputationWeight };
      });
  } catch (error) {
    console.warn('Vector retrieval unavailable, using reputation fallback:', (error as Error).message);
  }

  // Fallback: no embeddings (missing key, index or budget)
  if (candidates.length === 0) {
    const snapshot = await agentsRef.where('status', '==', 'active').limit(100).get();
    candidates = snapshot.docs.map((d) => ({
      id: d.id,
      data: d.data(),
      score: Math.log10((d.data().verified_task_count || 0) + 1),
    }));
  }

  if (location) {
    const loc = location.toLowerCase();
    candidates = candidates.filter((c) => (c.data.location || '').toLowerCase() === loc);
  }
  if (timezone) candidates = candidates.filter((c) => c.data.timezone === timezone);
  if (candidates.length === 0) return [];

  // 3. Reputation-weighted order
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, RERANK_POOL);

  // 4. Jev relevance check over the short list
  let ordered = top;
  if (jevConfigured() && top.length > 1) {
    try {
      if (!(await takeAiBudget('rerank'))) throw new Error('Daily re-rank budget reached');
      ordered = await rerankWithJev(queryText, top);
    } catch (error) {
      console.warn('Jev re-rank unavailable, keeping reputation order:', (error as Error).message);
    }
  }

  return ordered.map((c) => toPublicAgent(c.id, c.data));
}
