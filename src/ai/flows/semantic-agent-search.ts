'use server';

/**
 * @fileOverview Implements Hybrid Semantic Search using Firestore Vector Index and Gemini Re-ranking.
 * 
 * - semanticAgentSearch - Main search function.
 * - Performs vector search via findNearest (scalable).
 * - Matches the 768-dimension output of text-embedding-004.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeAdmin } from '@/firebase/admin';

const SemanticAgentSearchInputSchema = z.object({
  query: z.string().describe('The search query from the human or agent.'),
});
export type SemanticAgentSearchInput = z.infer<typeof SemanticAgentSearchInputSchema>;

const SemanticAgentSearchOutputSchema = z.object({
  rankedIds: z.array(z.string()).describe('The IDs of the agents ranked by semantic relevance.'),
  reasoning: z.string().describe('Brief explanation of why these agents were selected.'),
});
export type SemanticAgentSearchOutput = z.infer<typeof SemanticAgentSearchOutputSchema>;

// Embedding model for the query (Produces 768 dimensions)
const embeddingModel = 'googleai/text-embedding-004';

const rankingPrompt = ai.definePrompt({
  name: 'semanticRankingPrompt',
  input: {
    schema: z.object({
      query: z.string(),
      candidates: z.array(z.any()),
    }),
  },
  output: { schema: SemanticAgentSearchOutputSchema },
  prompt: `You are the Search Architect for Agent Garden. I have performed a search for "{{query}}" and found these candidates.

Please re-rank them based on their actual manifest capabilities and description. Prioritize agents that explicitly mention the skills requested.

Candidates:
{{#each candidates}}
- ID: {{id}}
  Name: {{name}}
  Intro: {{introduction}}
  Skills: {{#each specialties}}{{this}}, {{/each}}
  Trust: Lvl {{trust_level}}
{{/each}}

Return the IDs ranked by relevance.`,
});

export async function semanticAgentSearch(input: SemanticAgentSearchInput): Promise<SemanticAgentSearchOutput> {
  return semanticAgentSearchFlow(input);
}

const semanticAgentSearchFlow = ai.defineFlow(
  {
    name: 'semanticAgentSearchFlow',
    inputSchema: SemanticAgentSearchInputSchema,
    outputSchema: SemanticAgentSearchOutputSchema,
  },
  async (input) => {
    const { db } = initializeAdmin();

    try {
      // 1. Generate 768-dimension Embedding for the Search Query
      const embeddingResponse = await ai.embed({
        model: embeddingModel,
        content: input.query,
      });

      const queryVector = embeddingResponse[0].embedding;

      // 2. Execute Firestore Vector Search (findNearest)
      // Matches the "Output field name" (embedding) and "Distance measure" (COSINE) in console.
      const agentsRef = db.collection('agents');
      let candidates: any[] = [];

      try {
        const vectorQuery = agentsRef.findNearest({
          vectorField: 'embedding',
          queryVector: queryVector,
          distanceMeasure: 'COSINE',
          limit: 20,
        });

        const snapshot = await vectorQuery.get();
        candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (vectorError) {
        // FALLBACK: If Vector Index is missing or still building, 
        // fetch active agents and let Gemini rank them.
        console.warn('Vector Search failed, falling back to keyword/active ranking.');
        const fallbackSnapshot = await agentsRef.where('status', '==', 'active').limit(20).get();
        candidates = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      if (candidates.length === 0) {
        return { rankedIds: [], reasoning: "The Garden is currently empty or your search was too specific." };
      }

      // 3. Re-rank results using Gemini for high-precision context matching
      const { output } = await rankingPrompt({
        query: input.query,
        candidates,
      });

      return output!;

    } catch (error: any) {
      console.error('Semantic Search Flow Error:', error);
      return { 
        rankedIds: [], 
        reasoning: "The search system is currently undergoing maintenance." 
      };
    }
  }
);
