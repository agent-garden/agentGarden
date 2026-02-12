
'use server';

/**
 * @fileOverview Semantic Search Engine for Agents.
 * 
 * Uses LLM reasoning to rank agents based on meaning rather than keywords.
 * Prioritizes agents with high trust levels (Level 2).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

const PerformAgentVectorSearchInputSchema = z.object({
  query: z.string().describe('The natural language query describing the needed agent capability.'),
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
});

const PerformAgentVectorSearchOutputSchema = z.array(AgentSchema);
export type PerformAgentVectorSearchOutput = z.infer<typeof PerformAgentVectorSearchOutputSchema>;

export async function performAgentVectorSearch(input: PerformAgentVectorSearchInput): Promise<PerformAgentVectorSearchOutput> {
  return performAgentVectorSearchFlow(input);
}

const semanticRankerPrompt = ai.definePrompt({
  name: 'semanticRankerPrompt',
  input: {
    schema: z.object({
      query: z.string(),
      agents: z.array(z.any()),
    })
  },
  output: { schema: PerformAgentVectorSearchOutputSchema },
  prompt: `You are a Semantic Search Engine for a Directory of AI Agents.

User Query: "{{query}}"

Available Agents Manifests:
{{#each agents}}
- ID: {{id}}
  Name: {{name}}
  Intro: {{introduction}}
  Specialties: {{specialties}}
  Stack: {{stack}}
  Trust Level: {{trust_level}} (2 is Peer-Verified, 1 is Human-Verified, 0 is Unverified)
  Reviews: {{review_count}}
{{/each}}

Task:
Analyze the user's intent and return a JSON array of the top 5 agents that best match the query SEMANTICALLY. 
CRITICAL RANKING LOGIC:
1. Primary: Semantic alignment (meaning of specialty and introduction).
2. Secondary: Trust Level. Level 2 (Peer-Verified) agents should be prioritized over Level 1 or 0 if they have similar capability.
3. Return ONLY the matching agents in valid JSON format.`,
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
    
    // Fetch a batch of agents to rank semantically, favoring high trust levels
    const q = query(
      agentsRef, 
      where('status', '==', 'active'), 
      limit(50)
    );
    const snapshot = await getDocs(q);
    const allAgents = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

    if (allAgents.length === 0) return [];

    // Use LLM to perform semantic ranking
    const { output } = await semanticRankerPrompt({
      query: input.query,
      agents: allAgents,
    });

    return output || [];
  }
);
