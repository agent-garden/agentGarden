'use server';

/**
 * @fileOverview Semantic memory discovery over the Knowledge Graph.
 *
 * Public nodes are searchable by anyone. Private nodes are only included when
 * the caller proves who they are with a Firebase ID token, and only that
 * caller's own nodes are returned. Nodes are embedded at write time by the
 * memory sync API (`embedding` field, 768-dim text-embedding-004).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeAdmin } from '@/firebase/admin';

const SearchKnowledgeGraphInputSchema = z.object({
  query: z.string().describe('The knowledge topic to retrieve from the collective memory.'),
  idToken: z.string().optional().describe('Caller Firebase ID token; unlocks their own private nodes.'),
});
export type SearchKnowledgeGraphInput = z.infer<typeof SearchKnowledgeGraphInputSchema>;

const KnowledgeNodeSchema = z.object({
  id: z.string(),
  content: z.string(),
  agent_id: z.string(),
  is_public: z.boolean(),
  topic_tags: z.array(z.string()),
  created_at: z.number(),
});

const SearchKnowledgeGraphOutputSchema = z.array(KnowledgeNodeSchema);
export type SearchKnowledgeGraphOutput = z.infer<typeof SearchKnowledgeGraphOutputSchema>;

const EMBEDDING_MODEL = 'googleai/text-embedding-004';

export async function searchKnowledgeGraph(input: SearchKnowledgeGraphInput): Promise<SearchKnowledgeGraphOutput> {
  return searchKnowledgeGraphFlow(input);
}

function toNode(id: string, d: any): z.infer<typeof KnowledgeNodeSchema> {
  const created =
    typeof d.created_at === 'number' ? d.created_at : d.created_at?.toMillis?.() ?? 0;
  return {
    id,
    content: String(d.content || ''),
    agent_id: String(d.agent_id || ''),
    is_public: d.is_public !== false,
    topic_tags: Array.isArray(d.topic_tags) ? d.topic_tags : [],
    created_at: created,
  };
}

const searchKnowledgeGraphFlow = ai.defineFlow(
  {
    name: 'searchKnowledgeGraphFlow',
    inputSchema: SearchKnowledgeGraphInputSchema,
    outputSchema: SearchKnowledgeGraphOutputSchema,
  },
  async (input) => {
    const queryText = input.query.trim().slice(0, 500);
    if (!queryText) return [];

    const { db, auth } = initializeAdmin();
    const nodesRef = db.collection('knowledge_nodes');

    let ownerUid: string | null = null;
    if (input.idToken) {
      try {
        ownerUid = (await auth.verifyIdToken(input.idToken)).uid;
      } catch {
        ownerUid = null;
      }
    }

    try {
      const [embedding] = await ai.embed({ embedder: EMBEDDING_MODEL, content: queryText });
      const vector = embedding.embedding;

      const searches = [
        nodesRef
          .where('is_public', '==', true)
          .findNearest({ vectorField: 'embedding', queryVector: vector, distanceMeasure: 'COSINE', limit: 10 })
          .get(),
      ];
      if (ownerUid) {
        searches.push(
          nodesRef
            .where('owner_id', '==', ownerUid)
            .findNearest({ vectorField: 'embedding', queryVector: vector, distanceMeasure: 'COSINE', limit: 10 })
            .get()
        );
      }

      const snapshots = await Promise.all(searches);
      const seen = new Map<string, z.infer<typeof KnowledgeNodeSchema>>();
      for (const snap of snapshots) {
        for (const doc of snap.docs) {
          const data = doc.data();
          // Never leak someone else's private node.
          if (data.is_public === false && data.owner_id !== ownerUid) continue;
          if (!seen.has(doc.id)) seen.set(doc.id, toNode(doc.id, data));
        }
      }
      return Array.from(seen.values());
    } catch (error) {
      console.warn('Memory vector search unavailable:', error);
      return [];
    }
  }
);
