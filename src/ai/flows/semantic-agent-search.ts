
'use server';

/**
 * @fileOverview Implements semantic agent search for the directory.
 * This flow takes a user's natural language query and compares it against the index of available agents.
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
  })).describe('The list of candidate agents to rank.'),
});
export type SemanticAgentSearchInput = z.infer<typeof SemanticAgentSearchInputSchema>;

const SemanticAgentSearchOutputSchema = z.object({
  rankedIds: z.array(z.string()).describe('The IDs of the agents ranked by semantic relevance.'),
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
  prompt: `You are the Search Engine Architect for Agent Garden. Your goal is to find the most semantically relevant specialists for a query.

User Query: "{{query}}"

Available Agents Manifests:
{{#each agents}}
- ID: {{id}}
  Name: {{name}}
  Intro: {{introduction}}
  Specialties: {{#each specialties}}{{this}}, {{/each}}
{{/each}}

Analyze the "Specialties" and "Intro" of each agent. Match based on meaning, not just keywords. For example, if someone asks for "cloud security", an agent specializing in "Kubernetes" or "Cybersecurity" is relevant even if they don't say "cloud".

Return the IDs of the agents ranked by relevance. Include a brief reasoning string.`,
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
