'use server';

/**
 * @fileOverview Reputation-weighted semantic agent search.
 *
 * 1. Embed the query (text-embedding-004, same model family the Firestore
 *    Vector Search extension uses to embed each agent's `search_text`).
 * 2. Firestore `findNearest` over `agents.embedding` (COSINE, top 50).
 * 3. Re-rank: similarity * (log10(verified_task_count + 1) + 1).
 * 4. Final relevance check by an LLM over the top 15.
 *
 * If embeddings or the vector index are unavailable, falls back to active
 * agents sorted by verified work so search still returns something useful.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeAdmin } from '@/firebase/admin';

const PerformAgentVectorSearchInputSchema = z.object({
  query: z.string().describe('The search query describing the needed agent capability.'),
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

const PerformAgentVectorSearchOutputSchema = z.array(AgentSchema);
export type PerformAgentVectorSearchOutput = z.infer<typeof PerformAgentVectorSearchOutputSchema>;

const EMBEDDING_MODEL = 'googleai/text-embedding-004';
const VECTOR_POOL = 50;
const RERANK_POOL = 15;
const MAX_QUERY_LENGTH = 500;

const rankingPrompt = ai.definePrompt({
  name: 'agentRankingPrompt',
  input: {
    schema: z.object({
      query: z.string(),
      agents: z.array(z.any()),
    }),
  },
  output: {
    schema: z.object({
      ranked_ids: z
        .array(z.string())
        .describe('IDs of agents that genuinely match the query, most relevant first. Omit agents that lack the requested skills.'),
    }),
  },
  prompt: `You are the Discovery Engine for the Agent Garden.
A user is looking for an AI agent with this intent: "{{query}}"

Candidates were pre-ranked by semantic similarity weighted by verified work
("PageRank for Agents": similarity * log10(verified jobs + 1)).

{{#each agents}}
- ID: {{id}} | Name: {{name}} | Intro: {{introduction}} | Specialties: {{#each specialties}}{{this}}, {{/each}} | Verified Jobs: {{verified_task_count}} | Reputation: {{reputation}}
{{/each}}

Confirm each candidate actually has the skills requested. Keep the pre-ranked
order unless relevance clearly says otherwise. Return the matching IDs.`,
});

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

export async function performAgentVectorSearch(
  input: PerformAgentVectorSearchInput
): Promise<PerformAgentVectorSearchOutput> {
  return performAgentVectorSearchFlow(input);
}

const performAgentVectorSearchFlow = ai.defineFlow(
  {
    name: 'performAgentVectorSearchFlow',
    inputSchema: PerformAgentVectorSearchInputSchema,
    outputSchema: PerformAgentVectorSearchOutputSchema,
  },
  async (input) => {
    const queryText = input.query.trim().slice(0, MAX_QUERY_LENGTH);
    if (!queryText) return [];

    const { db } = initializeAdmin();
    const agentsRef = db.collection('agents');

    type Candidate = { id: string; data: any; score: number };
    let candidates: Candidate[] = [];

    // 1-2. Semantic retrieval
    try {
      const [embedding] = await ai.embed({ embedder: EMBEDDING_MODEL, content: queryText });
      const snapshot = await agentsRef
        .findNearest({
          vectorField: 'embedding',
          queryVector: embedding.embedding,
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
      console.warn('Vector retrieval unavailable, using reputation fallback:', error);
    }

    // Fallback: no embeddings yet (missing key, index or backfill)
    if (candidates.length === 0) {
      const snapshot = await agentsRef.where('status', '==', 'active').limit(100).get();
      candidates = snapshot.docs.map((d) => ({
        id: d.id,
        data: d.data(),
        score: Math.log10((d.data().verified_task_count || 0) + 1),
      }));
    }

    // Optional structured filters
    if (input.location) {
      const loc = input.location.toLowerCase();
      candidates = candidates.filter((c) => (c.data.location || '').toLowerCase() === loc);
    }
    if (input.timezone) {
      candidates = candidates.filter((c) => c.data.timezone === input.timezone);
    }
    if (candidates.length === 0) return [];

    // 3. Reputation-weighted order
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, RERANK_POOL);

    // 4. LLM relevance check over the short list
    let ordered = top;
    try {
      const { output } = await rankingPrompt({
        query: queryText,
        agents: top.map((c) => ({
          id: c.id,
          name: c.data.name,
          introduction: c.data.introduction,
          specialties: c.data.specialties || [],
          verified_task_count: c.data.verified_task_count || 0,
          reputation: c.data.reputation || 0,
        })),
      });
      const ids = output?.ranked_ids ?? [];
      const byId = new Map(top.map((c) => [c.id, c]));
      const reranked = ids.map((id) => byId.get(id)).filter(Boolean) as Candidate[];
      if (reranked.length > 0) ordered = reranked;
    } catch (error) {
      console.warn('LLM re-rank unavailable, keeping reputation order:', error);
    }

    return ordered.map((c) => toPublicAgent(c.id, c.data));
  }
);
