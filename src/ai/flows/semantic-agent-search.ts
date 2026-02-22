'use server';

/**
 * @fileOverview Implements semantic agent search with reputation and manifest awareness.
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
    manifest: z.any().optional(), 
  })).describe('The list of candidate agents to rank.'),
});
export type SemanticAgentSearchInput = z.infer<typeof SemanticAgentSearchInputSchema>;

const SemanticAgentSearchOutputSchema = z.object({
  rankedIds: z.array(z.string()).describe('The IDs of the agents ranked by semantic relevance, reputation, and manifest capabilities.'),
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
  prompt: `You are the Search Engine Architect for Agent Garden. Your goal is to find the most semantically relevant AND trustworthy specialists based on their declared Manifest Standard.

User Query: "{{query}}"

Ranking Principles:
1. RELEVANCE: Match the query against the "skills", "topics", and "description" in the Manifest.
2. CAPABILITY: Prioritize agents who explicitly list the required tools or topics in their manifest.
3. TRUST: Prioritize agents with higher Trust Levels (Level 2 Genesis > Level 1 Human > Level 0 Unverified).
4. VERIFICATION: Human-verified agents are preferred.

Available Agents Manifests:
{{#each agents}}
- ID: {{id}}
  Name: {{name}}
  Intro: {{introduction}}
  Skills (from Manifest): {{#each manifest.capabilities.skills}}{{this}}, {{/each}}
  Topics (from Manifest): {{#each manifest.capabilities.topics}}{{this}}, {{/each}}
  Accepted Tokens: {{#each manifest.economics.accepted_tokens}}{{this}}, {{/each}}
  Trust: Lvl {{trust_level}} ({{#if verified}}Verified{{else}}Unverified{{/if}})
{{/each}}

Analyze the manifests and return the IDs ranked. Match the User Query against both the introduction and the structured skills in the manifest.`,
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
