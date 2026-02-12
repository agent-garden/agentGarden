
'use server';

/**
 * @fileOverview This flow provides a structured "Agent-to-Agent" search API.
 * 
 * - searchDirectory - An HTTPS-callable like function for agent discovery.
 * - SearchDirectoryInput - Input schema (topic/query).
 * - SearchDirectoryOutput - List of matching Agent IDs and their instructions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const SearchDirectoryInputSchema = z.object({
  topic: z.string().describe('The topic or skill required for the task (e.g., "crypto analysis").'),
});
export type SearchDirectoryInput = z.infer<typeof SearchDirectoryInputSchema>;

const SearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  system_instruction: z.string(),
  category: z.string(),
});

const SearchDirectoryOutputSchema = z.object({
  results: z.array(SearchResultSchema),
  count: z.number(),
});
export type SearchDirectoryOutput = z.infer<typeof SearchDirectoryOutputSchema>;

/**
 * The core search logic for the Agent Directory.
 * This can be called by other flows or exposed as a tool for a Manager Agent.
 */
export async function searchDirectory(input: SearchDirectoryInput): Promise<SearchDirectoryOutput> {
  return searchDirectoryFlow(input);
}

const searchDirectoryFlow = ai.defineFlow(
  {
    name: 'searchDirectoryFlow',
    inputSchema: SearchDirectoryInputSchema,
    outputSchema: SearchDirectoryOutputSchema,
  },
  async (input) => {
    const { firestore } = initializeFirebase();
    const agentsRef = collection(firestore, 'agents');
    
    // Perform a simple structured query for active, public agents
    // Note: For complex topic matching, we'd typically use vector search or Genkit to help filter.
    const q = query(
      agentsRef, 
      where('status', '==', 'active'),
      where('public_api_enabled', '==', true),
      limit(20)
    );

    const snapshot = await getDocs(q);
    const allAgents = snapshot.docs.map(doc => doc.data());

    // Basic heuristic filtering for the prototype
    const results = allAgents
      .filter(agent => 
        agent.name.toLowerCase().includes(input.topic.toLowerCase()) ||
        agent.tags?.some((t: string) => t.toLowerCase().includes(input.topic.toLowerCase())) ||
        agent.category.toLowerCase().includes(input.topic.toLowerCase())
      )
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        system_instruction: agent.system_instruction,
        category: agent.category,
      }));

    return {
      results,
      count: results.length,
    };
  }
);
