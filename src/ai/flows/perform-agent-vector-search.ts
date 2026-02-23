
'use server';

/**
 * @fileOverview Reputation-Aware Discovery Engine for the Agent Garden.
 * 
 * Uses a Genkit-powered Semantic Ranker to match user intent to agent manifests.
 * Re-ranks results based on Reputation, Karma, and Expertise Graph weights.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';

const PerformAgentVectorSearchInputSchema = z.object({
  query: z.string().describe('The search query describing the needed agent capability.'),
  location: z.string().optional(),
  timezone: z.string().optional(),
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
  reputation: z.number().optional(),
  review_count: z.number().optional(),
  public_key: z.string(),
  availability: z.string(),
  security_status: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
});

const PerformAgentVectorSearchOutputSchema = z.array(AgentSchema);
export type PerformAgentVectorSearchOutput = z.infer<typeof PerformAgentVectorSearchOutputSchema>;

/**
 * Performs a deep semantic discovery using Genkit ranking augmented by reputation.
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
      ranked_ids: z.array(z.string()).describe('IDs of the agents that match the query, ordered by relevance and authority.'),
    }),
  },
  prompt: `You are the Discovery Engine for the Agent Garden. 
  A user is looking for an AI agent with this intent: "{{query}}"
  
  Here is a list of candidate agents in the garden, with their reputation stats:
  {{#each agents}}
  - ID: {{id}}, Name: {{name}}, Intro: {{introduction}}, Specialties: {{#each specialties}}{{this}}, {{/each}}, Rep: {{reputation}}, Endorsements: {{endorsement_weight}}
  {{/each}}
  
  TASK:
  1. Analyze the user's intent.
  2. Rank agents by a combination of Technical Capability, Security Trust, and Reputation Weight.
  3. High reputation and endorsement weight should boost agents with similar technical capabilities.
  4. Return the IDs of the matching agents, ordered from most relevant to least relevant.`,
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
    
    // 1. Fetch Candidates with optional filters
    let baseQuery = query(agentsRef, where('status', '==', 'active'));
    
    if (input.location) {
      baseQuery = query(baseQuery, where('location', '==', input.location));
    }
    if (input.timezone) {
      baseQuery = query(baseQuery, where('timezone', '==', input.timezone));
    }

    const snapshot = await getDocs(query(baseQuery, limit(100)));
    
    if (snapshot.empty) return [];

    const candidates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    // 2. Fetch Endorsement weights for candidates (Simulated aggregation for prototype)
    // In production, use a dedicated aggregation or cached field.
    const candidatesWithRep = candidates.map(c => ({
      ...c,
      endorsement_weight: (c.reputation || 0) + (c.review_count || 0) * 5 
    }));

    // 3. Use Gemini to perform high-fidelity semantic ranking
    try {
      const { output } = await rankingPrompt({
        query: input.query,
        agents: candidatesWithRep.map(c => ({
          id: c.id,
          name: c.name,
          introduction: c.introduction,
          specialties: c.specialties,
          reputation: c.reputation,
          endorsement_weight: c.endorsement_weight
        }))
      });

      if (!output?.ranked_ids || output.ranked_ids.length === 0) {
        // Fallback to basic reputation sort if AI ranking yields nothing
        return candidatesWithRep.sort((a, b) => b.reputation - a.reputation).slice(0, 20) as any;
      }

      const rankedAgents = output.ranked_ids
        .map(id => candidatesWithRep.find(c => c.id === id))
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
        reputation: agent.reputation || 0,
        review_count: agent.review_count || 0,
        public_key: agent.public_key || "",
        availability: agent.availability || "Active",
        security_status: agent.security_status || "unverified",
        location: agent.location || "Cloud",
        timezone: agent.timezone || "UTC"
      })) as PerformAgentVectorSearchOutput;

    } catch (error) {
      console.error("Semantic Ranking failed:", error);
      return [];
    }
  }
);
