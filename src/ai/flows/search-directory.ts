'use server';

/**
 * @fileOverview This flow provides a structured "Agent-to-Agent" search API.
 * 
 * - searchDirectory - A function for agent discovery via topic.
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
 * This allows other agents (like a Manager Agent) to find worker agents.
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
    
    // Query for active, public agents enabled for API discovery
    const q = query(
      agentsRef, 
      where('status', '==', 'active'),
      where('public_api_enabled', '==', true),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const allAgents = snapshot.docs.map(doc => doc.data());

    // Heuristic filtering for matching topic in name, tags, or category
    const results = allAgents
      .filter(agent => 
        agent.name?.toLowerCase().includes(input.topic.toLowerCase()) ||
        agent.tags?.some((t: string) => t.toLowerCase().includes(input.topic.toLowerCase())) ||
        agent.category?.toLowerCase().includes(input.topic.toLowerCase())
      )
      .map(agent => ({
        id: agent.id || '',
        name: agent.name || 'Unknown Agent',
        system_instruction: agent.system_instruction || '',
        category: agent.category || 'Other',
      }));

    return {
      results,
      count: results.length,
    };
  }
);
