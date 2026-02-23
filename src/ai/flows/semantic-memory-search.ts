'use server';

/**
 * @fileOverview Semantic Memory Search Flow.
 * 
 * - semanticMemorySearch - Main search function for Knowledge Nodes.
 * - Applies strict privacy filters: public nodes + agent's own private nodes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeAdmin } from '@/firebase/admin';

const SemanticMemorySearchInputSchema = z.object({
  query: z.string().describe('The concept or memory to search for.'),
  agentId: z.string().optional().describe('The ID of the agent performing the search (to include its private nodes).'),
});
export type SemanticMemorySearchInput = z.infer<typeof SemanticMemorySearchInputSchema>;

const SemanticMemorySearchOutputSchema = z.object({
  memories: z.array(z.object({
    id: z.string(),
    content: z.string(),
    is_public: z.boolean(),
    topic_tags: z.array(z.string()),
    agent_id: z.string(),
  })),
  reasoning: z.string().describe('Brief explanation of relevance.'),
});
export type SemanticMemorySearchOutput = z.infer<typeof SemanticMemorySearchOutputSchema>;

const embeddingModel = 'googleai/text-embedding-004';

export async function semanticMemorySearch(input: SemanticMemorySearchInput): Promise<SemanticMemorySearchOutput> {
  return semanticMemorySearchFlow(input);
}

const semanticMemorySearchFlow = ai.defineFlow(
  {
    name: 'semanticMemorySearchFlow',
    inputSchema: SemanticMemorySearchInputSchema,
    outputSchema: SemanticMemorySearchOutputSchema,
  },
  async (input) => {
    const { db } = initializeAdmin();

    try {
      // 1. Generate Query Vector
      const embeddingResponse = await ai.embed({
        model: embeddingModel,
        content: input.query,
      });
      const queryVector = embeddingResponse[0].embedding;

      // 2. Perform Vector Search on Knowledge Nodes
      const knowledgeRef = db.collection('knowledge_nodes');
      
      // PRE-FILTER: We can only filter by simple conditions in findNearest.
      // We will fetch public nodes semantic nearest matches.
      const publicVectorQuery = knowledgeRef.where('is_public', '==', true).findNearest({
        vectorField: 'embedding',
        queryVector: queryVector,
        distanceMeasure: 'COSINE',
        limit: 20,
      });

      const publicSnapshot = await publicVectorQuery.get();
      let candidates = publicSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 3. If agentId is provided, also search its private nodes
      if (input.agentId) {
        const privateVectorQuery = knowledgeRef
          .where('agent_id', '==', input.agentId)
          .where('is_public', '==', false)
          .findNearest({
            vectorField: 'embedding',
            queryVector: queryVector,
            distanceMeasure: 'COSINE',
            limit: 10,
          });
        
        const privateSnapshot = await privateVectorQuery.get();
        const privateCandidates = privateSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        candidates = [...candidates, ...privateCandidates];
      }

      // 4. Re-rank or simple return
      return {
        memories: candidates.map(c => ({
          id: c.id,
          content: c.content,
          is_public: c.is_public,
          topic_tags: c.topic_tags || [],
          agent_id: c.agent_id
        })),
        reasoning: `Found ${candidates.length} relevant memory segments across public and private authorized nodes.`
      };

    } catch (error: any) {
      console.error('Memory Search Flow Error:', error);
      return { memories: [], reasoning: "Memory retrieval failed." };
    }
  }
);
