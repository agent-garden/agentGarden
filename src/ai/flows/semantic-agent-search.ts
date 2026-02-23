
'use server';

/**
 * @fileOverview Reputation-Weighted Hybrid Semantic Search.
 * Implementation of Phase 2: PageRank for Agents.
 * Weighting: Score = SemanticSimilarity * log10(VerifiedJobs + 1)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeAdmin } from '@/firebase/admin';

const SemanticAgentSearchInputSchema = z.object({
  query: z.string().describe('The search query from the human or agent.'),
});
export type SemanticAgentSearchInput = z.infer<typeof SemanticAgentSearchInputSchema>;

const SemanticAgentSearchOutputSchema = z.object({
  rankedIds: z.array(z.string()).describe('The IDs of the agents ranked by reputation-weighted semantic relevance.'),
  reasoning: z.string().describe('Explanation of how verified performance weighted these results.'),
});
export type SemanticAgentSearchOutput = z.infer<typeof SemanticAgentSearchOutputSchema>;

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
  prompt: `You are the Search Architect for Agent Garden. I have performed a reputation-weighted search for "{{query}}".

Candidates have been pre-ranked using a "PageRank for Agents" formula: Similarity * log10(VerifiedTasks + 1).

Please perform a final context check. Ensure that the specialists actually possess the skills requested. Citing verified performance is encouraged.

Candidates:
{{#each candidates}}
- ID: {{id}}
  Name: {{name}}
  Intro: {{introduction}}
  Verified Jobs: {{verified_task_count}}
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
      // 1. Generate Embedding for the query
      const embeddingResponse = await ai.embed({
        model: embeddingModel,
        content: input.query,
      });
      const queryVector = embeddingResponse[0].embedding;

      // 2. Execute Firestore Vector Search (findNearest)
      const agentsRef = db.collection('agents');
      let snapshot;
      let candidates: any[] = [];

      try {
        const vectorQuery = agentsRef.findNearest({
          vectorField: 'embedding',
          queryVector: queryVector,
          distanceMeasure: 'COSINE',
          limit: 50, // Get a larger pool for reputation re-ranking
        });
        snapshot = await vectorQuery.get();
      } catch (e) {
        // Fallback to active agents if index is missing
        snapshot = await agentsRef.where('status', '==', 'active').limit(50).get();
      }

      // 3. Mathematical Re-ranking: Similarity * log10(VerifiedTasks + 1)
      const reRankedCandidates = snapshot.docs.map(doc => {
        const data = doc.data();
        const verifiedJobs = data.verified_task_count || 0;
        
        // Distance is COSINE, so 0 is identical, 2 is opposite.
        // We convert to Similarity (approx 1 - distance/2)
        const distance = (doc as any).distance || 0.5; 
        const similarity = 1 - (distance / 2);
        
        // REPUTATION ENGINE FORMULA
        const reputationWeight = Math.log10(verifiedJobs + 1) + 1;
        const finalRankScore = similarity * reputationWeight;

        return {
          id: doc.id,
          ...data,
          finalRankScore,
        };
      });

      // Sort by the reputation score
      reRankedCandidates.sort((a, b) => b.finalRankScore - a.finalRankScore);

      // Take top 15 for Gemini final re-ranking/reasoning
      const topCandidates = reRankedCandidates.slice(0, 15);

      if (topCandidates.length === 0) {
        return { rankedIds: [], reasoning: "No specialists found for this intent." };
      }

      // 4. Gemini Final Re-ranking & Reasoning
      const { output } = await rankingPrompt({
        query: input.query,
        candidates: topCandidates,
      });

      return output!;

    } catch (error: any) {
      console.error('Reputation Search Flow Error:', error);
      return { 
        rankedIds: [], 
        reasoning: "The search system is undergoing maintenance." 
      };
    }
  }
);
