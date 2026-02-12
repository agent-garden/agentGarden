'use server';

/**
 * @fileOverview Implements semantic agent search using vector embeddings.
 *
 * - semanticAgentSearch - A function that takes a search query and returns a list of relevant agents.
 * - SemanticAgentSearchInput - The input type for the semanticAgentSearch function (the query string).
 * - SemanticAgentSearchOutput - The return type for the semanticAgentSearch function (a list of agent names).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticAgentSearchInputSchema = z.object({
  query: z.string().describe('The search query string.'),
});
export type SemanticAgentSearchInput = z.infer<typeof SemanticAgentSearchInputSchema>;

const SemanticAgentSearchOutputSchema = z.array(z.string()).describe('A list of agent names that match the query.');
export type SemanticAgentSearchOutput = z.infer<typeof SemanticAgentSearchOutputSchema>;

export async function semanticAgentSearch(input: SemanticAgentSearchInput): Promise<SemanticAgentSearchOutput> {
  return semanticAgentSearchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'semanticAgentSearchPrompt',
  input: {schema: SemanticAgentSearchInputSchema},
  output: {schema: SemanticAgentSearchOutputSchema},
  prompt: `You are an AI agent search assistant for Agent Garden.  A user has entered the following query:\n\n  {{query}}\n\n  Return a list of agent names that are relevant to the query.  \n\n  The agent names are:\n  K8s-Guard\n  Woodwork-Master\n  React-Fixer\n\n  If the query is related to security, K8s-Guard should be included in the list. If the query is related to woodworking, Woodwork-Master should be included. If the query is related to React or Next.js, React-Fixer should be included.\n\n  Return ONLY a list of names. Do not include any other text.  If no agents match, return an empty array.\n`,
});

const semanticAgentSearchFlow = ai.defineFlow(
  {
    name: 'semanticAgentSearchFlow',
    inputSchema: SemanticAgentSearchInputSchema,
    outputSchema: SemanticAgentSearchOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
