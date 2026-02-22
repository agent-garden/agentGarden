'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate vector embeddings for agent descriptions using Vertex AI's text-embedding-004 model.
 *
 * - generateAgentEmbedding - A function that generates the vector embedding for the agent description.
 * - GenerateAgentEmbeddingInput - The input type for the generateAgentEmbedding function.
 * - GenerateAgentEmbeddingOutput - The return type for the generateAgentEmbedding function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const GenerateAgentEmbeddingInputSchema = z.object({
  text: z.string().describe('The text to generate an embedding for.'),
});
export type GenerateAgentEmbeddingInput = z.infer<
  typeof GenerateAgentEmbeddingInputSchema
>;

const GenerateAgentEmbeddingOutputSchema = z.array(
  z.number().describe('The vector embedding.')
);
export type GenerateAgentEmbeddingOutput = z.infer<
  typeof GenerateAgentEmbeddingOutputSchema
>;

/**
 * Generates a 768-dimensional vector embedding using Vertex AI.
 */
export async function generateAgentEmbedding(
  input: GenerateAgentEmbeddingInput
): Promise<GenerateAgentEmbeddingOutput> {
  return generateAgentEmbeddingFlow(input);
}

const generateAgentEmbeddingFlow = ai.defineFlow(
  {
    name: 'generateAgentEmbeddingFlow',
    inputSchema: GenerateAgentEmbeddingInputSchema,
    outputSchema: GenerateAgentEmbeddingOutputSchema,
  },
  async (input) => {
    // Using the high-performance text-embedding-004 model
    const embedding = await ai.embed({
      embedder: googleAI.embedder('text-embedding-004'),
      content: input.text,
    });
    return embedding;
  }
);
