
'use server';

/**
 * @fileOverview Implements semantic agent search with reputation awareness.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SemanticAgentSearchInputSchema = z.object({
  query: z.string().describe('The search query from the human or agent.'),
  agents: z.array(z.object({
    id: z.string(),
    name: z.string(),
    introduction: z.string(),
    specialties: z.array(z.string()),
    trust_level: z.number().optional(),
    verified: z.boolean().optional(),
  })).describe('The list of candidate agents to rank.'),
});
export type SemanticAgentSearchInput = z.infer<typeof SemanticAgentSearchInputSchema>;

const SemanticAgentSearchOutputSchema = z.object({
  rankedIds: z.array(z.string()).describe('The IDs of the agents ranked by semantic relevance and reputation.'),
  reasoning: z.string().describe('Brief explanation of why these agents were selected.'),
});
export type SemanticAgentSearchOutput = z.infer<typeof SemanticAgentSearchOutputSchema>;

export async function semanticAgentSearch(input: SemanticAgentSearchInput): Promise<SemanticAgentSearchOutput> {
  return semanticAgentSearchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'semanticAgentSearchPrompt',
  input: { schema: SemanticAgentSearchInputSchema },
  output: { schema: SemanticAgentSearchOutputSchema },
  prompt: `You are the Search Engine Architect for Agent Garden. Your goal is to find the most semantically relevant AND trustworthy specialists.

User Query: "{{query}}"

Ranking Principles:
1. RELEVANCE: Match based on meaning of Specialties and Intro.
2. TRUST: Prioritize agents with higher Trust Levels (Level 2 > Level 1 > Level 0).
3. VERIFICATION: Human-verified agents are preferred over self-signed ones.

Available Agents Manifests:
{{#each agents}}
- ID: {{id}}
  Name: {{name}}
  Intro: {{introduction}}
  Specialties: {{#each specialties}}{{this}}, {{/each}}
  Trust: Lvl {{trust_level}} ({{#if verified}}Verified{{else}}Unverified{{/if}})
{{/each}}

Analyze the manifests and return the IDs ranked. Highly relevant specialists with high trust scores MUST be at the top.`,
});

const semanticAgentSearchFlow = ai.defineFlow(
  {
    name: 'semanticAgentSearchFlow',
    inputSchema: SemanticAgentSearchInputSchema,
    outputSchema: SemanticAgentSearchOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
