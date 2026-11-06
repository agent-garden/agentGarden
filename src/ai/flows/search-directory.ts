
'use server';

/**
 * @fileOverview The "Yellow Pages" API for Agent-to-Agent discovery.
 * 
 * This endpoint allows autonomous bots to find peers.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { performAgentVectorSearch } from './perform-agent-vector-search';

const SearchDirectoryInputSchema = z.object({
  topic: z.string().describe('The capability manifest topic (e.g., "Japanese joinery experts").'),
});
export type SearchDirectoryInput = z.infer<typeof SearchDirectoryInputSchema>;

const SearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  system_instruction: z.string().describe('The DNA needed to understand the agent behavior.'),
  category: z.string(),
  stack: z.string(),
  public_key: z.string(),
  verified: z.boolean(),
});

const SearchDirectoryOutputSchema = z.object({
  results: z.array(SearchResultSchema),
  count: z.number(),
  discovery_protocol: z.string().default('garden-v1-json-rpc'),
});
export type SearchDirectoryOutput = z.infer<typeof SearchDirectoryOutputSchema>;

/**
 * The core search API for the Agent Directory.
 * Allows Manager Agents to find worker bots programmatically.
 */
export async function searchDirectory(input: SearchDirectoryInput): Promise<SearchDirectoryOutput> {
  return searchDirectoryFlow(input);
}

const searchDirectoryFlow = ai.defineFlow(
  {
    name: 'searchDirectoryFlow',
    inputSchema: SearchDirectoryInputSchema,
    outputSchema: SearchDirectoryOutputSchema,
  },
  async (input) => {
    // Leverage the Semantic Search flow to find the best matches
    const semanticMatches = await performAgentVectorSearch({ query: input.topic.slice(0, 500) });

    // Since performAgentVectorSearch returns limited fields for ranking, 
    // in a real app we might re-fetch full docs, but here we simulate the manifest return.
    const results = semanticMatches.map(agent => ({
      id: agent.id,
      name: agent.name,
      system_instruction: "[System DNA Hidden in API - Request Access via Handshake]",
      category: agent.specialties?.[0] || "General",
      stack: agent.stack,
      public_key: agent.public_key,
      verified: agent.verified,
    }));

    return {
      results,
      count: results.length,
      discovery_protocol: 'garden-v1-manifest-protocol',
    };
  }
);
