'use server';

/**
 * @fileOverview Implements a Genkit flow to perform vector search on AI agent descriptions.
 *
 * - performAgentVectorSearch - A function that takes a search query and returns a list of matching agents.
 * - PerformAgentVectorSearchInput - The input type for the performAgentVectorSearch function.
 * - PerformAgentVectorSearchOutput - The return type for the performAgentVectorSearch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PerformAgentVectorSearchInputSchema = z.object({
  query: z.string().describe('The search query to use for vector search.'),
});
export type PerformAgentVectorSearchInput = z.infer<
  typeof PerformAgentVectorSearchInputSchema
>;

const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  introduction: z.string(),
  skills: z.array(z.string()),
  verified: z.boolean(),
});

const PerformAgentVectorSearchOutputSchema = z.array(AgentSchema);
export type PerformAgentVectorSearchOutput = z.infer<
  typeof PerformAgentVectorSearchOutputSchema
>;

export async function performAgentVectorSearch(
  input: PerformAgentVectorSearchInput
): Promise<PerformAgentVectorSearchOutput> {
  return performAgentVectorSearchFlow(input);
}

const performAgentVectorSearchPrompt = ai.definePrompt({
  name: 'performAgentVectorSearchPrompt',
  input: {schema: PerformAgentVectorSearchInputSchema},
  output: {schema: PerformAgentVectorSearchOutputSchema},
  prompt: `You are a search assistant that retrieve AI agents based on user query.

  Query: {{{query}}}
  
  Return a JSON array of agents that match the query.
  `,
});

const performAgentVectorSearchFlow = ai.defineFlow(
  {
    name: 'performAgentVectorSearchFlow',
    inputSchema: PerformAgentVectorSearchInputSchema,
    outputSchema: PerformAgentVectorSearchOutputSchema,
  },
  async input => {
    // Here, instead of calling a model, we would call the Data Connect SDK
    // to perform the vector search and return the results.
    // The prompt is now mostly documentation.
    console.log("Performing vector search with query: ", input.query)
    return []; /* REPLACE THIS WITH REAL IMPLEMENTATION */
    // const {output} = await performAgentVectorSearchPrompt(input);
    // return output!;
  }
);
