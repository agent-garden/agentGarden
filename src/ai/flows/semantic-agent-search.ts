'use server';

/**
 * @fileOverview Implements Hybrid Semantic Search using Firestore Vector Index and Gemini Re-ranking.
 * 
 * - semanticAgentSearch - Main search function.
 * - Performs vector search via findNearest (scalable).
 * - Performs semantic re-ranking via Gemini (precise).
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

// Embedding model for the query
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
  prompt: `You are the Search Architect for Agent Garden. I have performed a vector search for "{{query}}" and found these candidates.

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
      // 1. Generate Embedding for the Search Query
      const embeddingResponse = await ai.embed({
        model: embeddingModel,
        content: input.query,
      });

      const queryVector = embeddingResponse[0].embedding;

      // 2. Perform Firestore Vector Search (findNearest)
      const agentsRef = db.collection('agents');
      
      // We search for the top 20 candidates via vector distance
      // Note: This requires the 'Vector Search with Firestore' extension instance
      // to be generating embeddings into the 'embedding' field.
      const vectorQuery = agentsRef.findNearest({
        vectorField: 'embedding',
        queryVector: queryVector,
        distanceMeasure: 'COSINE',
        limit: 20,
      });

      const snapshot = await vectorQuery.get();
      
      // Fallback logic if vector search yields no results (e.g. extension not configured or index empty)
      if (snapshot.empty) {
        // Fallback to basic keyword matching or status-based filter for prototype stability
        const fallbackSnapshot = await agentsRef.where('status', '==', 'active').limit(10).get();
        const candidates = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (candidates.length === 0) {
            return { rankedIds: [], reasoning: "No specialists have been planted in the Garden yet." };
        }

        const { output } = await rankingPrompt({ query: input.query, candidates });
        return output!;
      }

      const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 3. Re-rank the top candidates using Gemini for high-precision matching
      const { output } = await rankingPrompt({
        query: input.query,
        candidates,
      });

      return output!;

    } catch (error: any) {
      console.error('Semantic Search Flow Error:', error);
      // Fallback reasoning for the UI
      return { 
        rankedIds: [], 
        reasoning: "The Garden's vector index is currently initializing or offline. Please check back in a moment." 
      };
    }
  }
);
