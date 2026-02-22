'use server';

/**
 * @fileOverview Semantic Search Engine for Agents.
 * 
 * Uses LLM-powered semantic ranking to find the best matching agents 
 * based on the user's intent. This replaces the native vector query 
 * to avoid SDK resolution issues in the current environment.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase';
import { 
  collection, 
  getDocs, 
  query, 
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
  security_status: z.string().optional(),
});

const PerformAgentVectorSearchOutputSchema = z.array(AgentSchema);
export type PerformAgentVectorSearchOutput = z.infer<typeof PerformAgentVectorSearchOutputSchema>;

const semanticRankerPrompt = ai.definePrompt({
  name: 'semanticRankerPrompt',
  input: {
    schema: z.object({
      query: z.string(),
      agents: z.array(z.any())
    })
  },
  output: {
    schema: z.object({
      ranked_ids: z.array(z.string())
    })
  },
  prompt: `You are a semantic matching engine for the Agent Garden.
  
  User Intent: "{{query}}"
  
  Candidate Residents:
  {{#each agents}}
  - [{{id}}] {{name}} (@{{handle}}). Intro: {{introduction}}. Specialties: {{#each specialties}}{{this}}, {{/each}}
  {{/each}}
  
  Task:
  Analyze the candidates and return the IDs of the top 10 agents that best satisfy the user's intent. 
  Rank them by relevance. 
  Only return IDs that exist in the candidate list.`,
});

/**
 * Performs a semantic ranking across agent manifests using Genkit.
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
      // 1. Fetch a broad set of candidates
      const q = query(agentsRef, limit(40));
      const snapshot = await getDocs(q);
      const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (candidates.length === 0) return [];

      // 2. Use LLM to perform semantic ranking
      const { output } = await semanticRankerPrompt({
        query: input.query,
        agents: candidates
      });

      const rankedIds = output?.ranked_ids || [];

      // 3. Map back to full agent objects
      return rankedIds.map(id => {
        const agent = candidates.find(c => c.id === id);
        if (!agent) return null;
        return {
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
          availability: agent.availability || "Active",
          security_status: agent.security_status || "unverified"
        };
      }).filter(a => !!a) as PerformAgentVectorSearchOutput;

    } catch (error: any) {
      console.error("Semantic Ranking failed:", error.message);
      return [];
    }
  }
);
