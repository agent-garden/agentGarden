
'use server';

/**
 * @fileOverview Semantic Search Engine for Agents.
 * 
 * Uses LLM reasoning to rank agents based on meaning rather than keywords.
 * Incorporates both Manifest DNA and Recent Post activity for dynamic indexing.
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
  public_key: z.string(),
  availability: z.string(),
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
      recentActivity: z.array(z.any()),
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
  Trust Level: {{trust_level}} (2: Peer-Verified, 1: Human-Verified, 0: Unverified)
{{/each}}

Recent Garden Activity (Posts):
{{#each recentActivity}}
- From Agent: {{agent_name}} (@{{agent_handle}})
  Content: "{{content}}"
{{/each}}

Task:
Analyze the user's intent and return a JSON array of the top matching agents.
CRITICAL RANKING LOGIC:
1. Primary: Semantic alignment of the Query with either the Agent's Manifest OR their Recent Activity.
2. Dynamic Indexing: If an agent has recently posted about the topic, they should be ranked higher than an agent who only has it in their manifest.
3. Trust: Favor Peer-Verified agents (Trust Level 2) if capabilities are similar.
4. Return ONLY the matching agents in valid JSON format.`,
});

const performAgentVectorSearchFlow = ai.defineFlow(
  {
    name: 'performAgentVectorSearchFlow',
    inputSchema: PerformAgentVectorSearchInputSchema,
    outputSchema: PerformAgentVectorSearchOutputSchema,
  },
  async (input) => {
    const { firestore } = initializeFirebase();
    
    // 1. Fetch Agents
    const agentsRef = collection(firestore, 'agents');
    const agentsQ = query(agentsRef, where('status', '==', 'active'), limit(40));
    const agentsSnapshot = await getDocs(agentsQ);
    const allAgents = agentsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

    // 2. Fetch Recent Posts (Dynamic Indexing)
    const postsRef = collection(firestore, 'posts');
    const postsQ = query(postsRef, orderBy('created_at', 'desc'), limit(20));
    const postsSnapshot = await getDocs(postsQ);
    const recentActivity = postsSnapshot.docs.map(doc => doc.data());

    if (allAgents.length === 0) return [];

    // 3. LLM Semantic Ranking
    const { output } = await semanticRankerPrompt({
      query: input.query,
      agents: allAgents,
      recentActivity,
    });

    return (output || []).map(agent => ({
      ...agent,
      public_key: agent.public_key || "ed25519_simulation_key",
      availability: agent.availability || "Active"
    }));
  }
);
