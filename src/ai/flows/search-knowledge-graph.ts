
'use server';

/**
 * @fileOverview Semantic Memory Discovery for the Knowledge Graph.
 * 
 * Implements privacy-aware search across collective agent memories.
 * Respects 'is_public' boundaries while allowing owners to query their own private data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';

const SearchKnowledgeGraphInputSchema = z.object({
  query: z.string().describe('The knowledge topic to retrieve from the collective memory.'),
  agent_id: z.string().optional().describe('The ID of the searching agent (for private memory access).'),
  owner_id: z.string().optional().describe('The ID of the searching gardener.'),
});
export type SearchKnowledgeGraphInput = z.infer<typeof SearchKnowledgeGraphInputSchema>;

const KnowledgeNodeSchema = z.object({
  id: z.string(),
  content: z.string(),
  agent_id: z.string(),
  is_public: z.boolean(),
  topic_tags: z.array(z.string()),
  created_at: z.number(),
});

const SearchKnowledgeGraphOutputSchema = z.array(KnowledgeNodeSchema);
export type SearchKnowledgeGraphOutput = z.infer<typeof SearchKnowledgeGraphOutputSchema>;

export async function searchKnowledgeGraph(input: SearchKnowledgeGraphInput): Promise<SearchKnowledgeGraphOutput> {
  return searchKnowledgeGraphFlow(input);
}

const rankerPrompt = ai.definePrompt({
  name: 'knowledgeRankerPrompt',
  input: {
    schema: z.object({
      query: z.string(),
      nodes: z.array(z.any()),
    }),
  },
  output: {
    schema: z.object({
      ranked_ids: z.array(z.string()).describe('IDs of the memory nodes that match the query, ordered by relevance.'),
    }),
  },
  prompt: `You are the Memory Librarian for the Agent Garden. 
  An agent/human is searching the collective knowledge graph for: "{{query}}"
  
  Available memory nodes:
  {{#each nodes}}
  - ID: {{id}}, Content: {{content}}, Topics: {{#each topic_tags}}{{this}}, {{/each}}
  {{/each}}
  
  TASK:
  1. Identify nodes that provide specific information or context related to the query.
  2. Order the IDs by relevance (most useful first).
  3. Only return IDs for nodes that are a solid match.`,
});

const searchKnowledgeGraphFlow = ai.defineFlow(
  {
    name: 'searchKnowledgeGraphFlow',
    inputSchema: SearchKnowledgeGraphInputSchema,
    outputSchema: SearchKnowledgeGraphOutputSchema,
  },
  async (input) => {
    const { firestore } = initializeFirebase();
    const nodesRef = collection(firestore, 'knowledge_nodes');
    
    // Privacy-Aware Fetch
    // 1. Fetch all public nodes
    const publicQuery = query(nodesRef, where('is_public', '==', true), limit(50));
    const publicSnapshot = await getDocs(publicQuery);
    
    let candidateDocs = publicSnapshot.docs;

    // 2. If an owner_id is provided, also fetch their private nodes
    if (input.owner_id) {
      const privateQuery = query(
        nodesRef, 
        where('owner_id', '==', input.owner_id), 
        where('is_public', '==', false),
        limit(50)
      );
      const privateSnapshot = await getDocs(privateQuery);
      candidateDocs = [...candidateDocs, ...privateSnapshot.docs];
    }

    if (candidateDocs.length === 0) return [];

    const candidates = candidateDocs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    // Deduplicate in case of overlap
    const uniqueCandidates = Array.from(new Map(candidates.map(c => [c.id, c])).values());

    // AI Semantic Ranking
    try {
      const { output } = await rankerPrompt({
        query: input.query,
        nodes: uniqueCandidates.map(c => ({
          id: c.id,
          content: c.content,
          topic_tags: c.topic_tags
        }))
      });

      if (!output?.ranked_ids || output.ranked_ids.length === 0) {
        return [];
      }

      return output.ranked_ids
        .map(id => uniqueCandidates.find(c => c.id === id))
        .filter(Boolean) as SearchKnowledgeGraphOutput;

    } catch (error) {
      console.error("Knowledge Ranking failed:", error);
      return [];
    }
  }
);
