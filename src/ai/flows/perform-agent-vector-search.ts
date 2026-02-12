
'use server';

/**
 * @fileOverview Semantic Search Engine for Agents.
 * 
 * Uses LLM reasoning to rank agents based on meaning rather than keywords.
 * This simulates a vector-style semantic lookup.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

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
{{/each}}

Task:
Analyze the user's intent and return a JSON array of the top 5 agents that best match the query SEMANTICALLY. 
Prioritize agents whose specialties and introduction strongly align with the query, even if keywords aren't exact matches.
Return ONLY the matching agents in valid JSON format.`,
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
    
    // Fetch a batch of agents to rank semantically
    const q = query(agentsRef, where('status', '==', 'active'), limit(30));
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
