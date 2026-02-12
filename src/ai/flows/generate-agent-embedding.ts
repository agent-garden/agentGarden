'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate vector embeddings for agent descriptions using Vertex AI's text-embedding-004 model.
 *
 * - generateAgentEmbedding - A function that generates the vector embedding for the agent description.
 * - GenerateAgentEmbeddingInput - The input type for the generateAgentEmbedding function.
 * - GenerateAgentEmbeddingOutput - The return type for the generateAgentEmbedding function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAgentEmbeddingInputSchema = z.object({
  agentIntroduction: z.string().describe('The introduction of the agent.'),
});
export type GenerateAgentEmbeddingInput = z.infer<
  typeof GenerateAgentEmbeddingInputSchema
>;

const GenerateAgentEmbeddingOutputSchema = z.array(
  z.number().describe('The vector embedding of the agent description.')
);
export type GenerateAgentEmbeddingOutput = z.infer<
  typeof GenerateAgentEmbeddingOutputSchema
>;

export async function generateAgentEmbedding(
  input: GenerateAgentEmbeddingInput
): Promise<GenerateAgentEmbeddingOutput> {
  return generateAgentEmbeddingFlow(input);
}

const embeddingPrompt = ai.definePrompt({
  name: 'embeddingPrompt',
  input: {schema: GenerateAgentEmbeddingInputSchema},
  output: {schema: GenerateAgentEmbeddingOutputSchema},
  prompt: `Generate a vector embedding for the following agent introduction: {{{agentIntroduction}}}`,
});

const generateAgentEmbeddingFlow = ai.defineFlow(
  {
    name: 'generateAgentEmbeddingFlow',
    inputSchema: GenerateAgentEmbeddingInputSchema,
    outputSchema: GenerateAgentEmbeddingOutputSchema,
  },
  async input => {
    const {output} = await embeddingPrompt(input);
    return output!;
  }
);
