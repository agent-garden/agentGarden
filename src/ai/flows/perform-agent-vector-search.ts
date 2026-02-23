
'use server';

/**
 * @fileOverview Semantic Discovery Engine for the Agent Garden.
 * 
 * Uses a Genkit-powered Semantic Ranker to match user intent to agent manifests.
 * This provides high-fidelity discovery by analyzing technical capability DNA.
 * Avoids SDK conflicts by performing ranking at the LLM layer.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';

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

/**
 * Performs a deep semantic discovery using Genkit ranking.
 */
export async function performAgentVectorSearch(input: PerformAgentVectorSearchInput): Promise<PerformAgentVectorSearchOutput> {
  return performAgentVectorSearchFlow(input);
}

const rankingPrompt = ai.definePrompt({
  name: 'rankingPrompt',
  input: {
    schema: z.object({
      query: z.string(),
      agents: z.array(z.any()),
    }),
  },
  output: {
    schema: z.object({
      ranked_ids: z.array(z.string()).describe('IDs of the agents that match the query, ordered by relevance.'),
    }),
  },
  prompt: `You are the Discovery Engine for the Agent Garden. 
  A user is looking for an AI agent with this intent: "{{query}}"
  
  Here is a list of candidate agents in the garden:
  {{#each agents}}
  - ID: {{id}}, Name: {{name}}, Intro: {{introduction}}, Specialties: {{#each specialties}}{{this}}, {{/each}}
  {{/each}}
  
  TASK:
  1. Analyze the user's intent.
  2. Identify which agents have the technical capabilities or specialties to help.
  3. Return the IDs of the matching agents, ordered from most relevant to least relevant.
  4. Only include agents that are a reasonable match for the intent.`,
});

const performAgentVectorSearchFlow = ai.defineFlow(
  {
    name: 'performAgentVectorSearchFlow',
    inputSchema: PerformAgentVectorSearchInputSchema,
    outputSchema: PerformAgentVectorSearchOutputSchema,
  },
  async (input) => {
    const { firestore } = initializeFirebase();
    const agentsRef = collection(firestore, 'agents');
    
    // Fetch active candidates for semantic ranking
    const q = query(agentsRef, where('status', '==', 'active'), limit(50));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return [];

    const candidates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    // Use Gemini to perform high-fidelity semantic ranking
    try {
      const { output } = await rankingPrompt({
        query: input.query,
        agents: candidates.map(c => ({
          id: c.id,
          name: c.name,
          introduction: c.introduction,
          specialties: c.specialties
        }))
      });

      if (!output?.ranked_ids || output.ranked_ids.length === 0) {
        return [];
      }

      const rankedAgents = output.ranked_ids
        .map(id => candidates.find(c => c.id === id))
        .filter(Boolean);

      return rankedAgents.map(agent => ({
        id: agent.id,
        name: agent.name || "Unknown Agent",
        handle: agent.handle || "@unknown",
        introduction: agent.introduction || "",
        specialties: agent.specialties || [],
        stack: agent.stack || "Unknown",
        verified: agent.verified || false,
        trust_level: agent.trust_level || 0,
        review_count: agent.review_count || 0,
        public_key: agent.public_key || "",
        availability: agent.availability || "Active",
        security_status: agent.security_status || "unverified"
      })) as PerformAgentVectorSearchOutput;

    } catch (error) {
      console.error("Semantic Ranking failed:", error);
      return [];
    }
  }
);
