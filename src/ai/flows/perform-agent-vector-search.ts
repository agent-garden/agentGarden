'use server';

/**
 * @fileOverview Search Engine for Agents.
 * 
 * Performs a robust search across agent manifests using keyword matching.
 * This ensures compatibility across server-side environments where specific 
 * vector search exports may have resolution conflicts.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where,
  limit 
} from 'firebase/firestore';

const PerformAgentVectorSearchInputSchema = z.object({
  query: z.string().describe('The search query describing the needed agent capability.'),
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
  review_count: z.number().optional(),
  public_key: z.string(),
  availability: z.string(),
});

const PerformAgentVectorSearchOutputSchema = z.array(AgentSchema);
export type PerformAgentVectorSearchOutput = z.infer<typeof PerformAgentVectorSearchOutputSchema>;

/**
 * Performs a search across agent manifests.
 */
export async function performAgentVectorSearch(input: PerformAgentVectorSearchInput): Promise<PerformAgentVectorSearchOutput> {
  return performAgentVectorSearchFlow(input);
}

const performAgentVectorSearchFlow = ai.defineFlow(
  {
    name: 'performAgentVectorSearchFlow',
    inputSchema: PerformAgentVectorSearchInputSchema,
    outputSchema: PerformAgentVectorSearchOutputSchema,
  },
  async (input) => {
    const { firestore } = initializeFirebase();
    const agentsRef = collection(firestore, 'agents');
    
    try {
      // For now, we fetch the most recent active agents and filter in-memory for the demo.
      // In a high-scale production environment, this would use a dedicated search index.
      const q = query(agentsRef, where('status', '==', 'active'), limit(50));
      const snapshot = await getDocs(q);
      
      const searchTerm = input.query.toLowerCase();
      const results = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter((agent: any) => {
          const nameMatch = agent.name?.toLowerCase().includes(searchTerm);
          const introMatch = agent.introduction?.toLowerCase().includes(searchTerm);
          const specialtyMatch = agent.specialties?.some((s: string) => s.toLowerCase().includes(searchTerm));
          return nameMatch || introMatch || specialtyMatch;
        });

      return results.map((agent: any) => ({
        id: agent.id,
        name: agent.name || "Unknown Agent",
        handle: agent.handle || "@unknown",
        introduction: agent.introduction || "",
        specialties: agent.specialties || [],
        stack: agent.stack || "Unknown",
        verified: agent.verified || false,
        trust_level: agent.trust_level || 0,
        review_count: agent.review_count || 0,
        public_key: agent.public_key || "ed25519_simulation_key",
        availability: agent.availability || "Active"
      }));
    } catch (error: any) {
      console.error("Search failed:", error.message);
      return [];
    }
  }
);
