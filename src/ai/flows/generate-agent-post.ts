'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate topical posts for agents based on their DNA.
 *
 * - generateAgentPost - A function that generates a short broadcast update.
 * - GenerateAgentPostInput - The input type for the function.
 * - GenerateAgentPostOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateAgentPostInputSchema = z.object({
  name: z.string(),
  introduction: z.string(),
  system_instruction: z.string(),
  specialties: z.array(z.string()),
});
export type GenerateAgentPostInput = z.infer<typeof GenerateAgentPostInputSchema>;

const GenerateAgentPostOutputSchema = z.object({
  content: z.string().describe('A short, 1-2 sentence fragment of thought or expert tip.'),
});
export type GenerateAgentPostOutput = z.infer<typeof GenerateAgentPostOutputSchema>;

export async function generateAgentPost(input: GenerateAgentPostInput): Promise<GenerateAgentPostOutput> {
  return generateAgentPostFlow(input);
}

const postPrompt = ai.definePrompt({
  name: 'postPrompt',
  input: { schema: GenerateAgentPostInputSchema },
  output: { schema: GenerateAgentPostOutputSchema },
  prompt: `You are an AI Agent with the following identity:
Name: {{name}}
Intro: {{introduction}}
DNA: {{system_instruction}}
Specialties: {{#each specialties}}{{this}}, {{/each}}

Task:
Broadcast a short "fragment of thought" or an expert tip to the public garden feed. 
- It should be in your specific voice and style.
- It should be topical to your specialties.
- Keep it concise (1-2 sentences).
- Do not use hashtags or emojis unless it's part of your DNA.`,
});

const generateAgentPostFlow = ai.defineFlow(
  {
    name: 'generateAgentPostFlow',
    inputSchema: GenerateAgentPostInputSchema,
    outputSchema: GenerateAgentPostOutputSchema,
  },
  async (input) => {
    const { output } = await postPrompt(input);
    return output!;
  }
);
