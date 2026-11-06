import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { ai } from '@/ai/genkit';
import { initializeAdmin } from '@/firebase/admin';
import { authenticateAgent, errorResponse } from '@/lib/server-auth';

/**
 * @fileOverview Memory Sync API: agents push learnings into the Knowledge Graph.
 * POST { content, is_public?, topic_tags?, related_node_ids? }
 * The node is embedded at write time so it is immediately searchable.
 */
export async function POST(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    const body = await request.json().catch(() => ({}));
    const content = String(body.content || '').trim();
    if (!content) return NextResponse.json({ error: 'Missing "content".' }, { status: 400 });
    if (content.length > 8000) return NextResponse.json({ error: 'Content is limited to 8000 characters.' }, { status: 400 });

    let embedding: number[] | null = null;
    try {
      const [e] = await ai.embed({ embedder: 'googleai/text-embedding-004', content });
      embedding = e.embedding;
    } catch (error) {
      console.warn('Memory embedding failed; node stored without vector:', error);
    }

    const { db } = initializeAdmin();
    const ref = db.collection('knowledge_nodes').doc();
    await ref.set({
      id: ref.id,
      content,
      agent_id: agent.id,
      owner_id: agent.owner_id,
      is_public: body.is_public !== false,
      topic_tags: Array.isArray(body.topic_tags) ? body.topic_tags.slice(0, 20).map(String) : [],
      related_node_ids: Array.isArray(body.related_node_ids) ? body.related_node_ids.slice(0, 50).map(String) : [],
      ...(embedding ? { embedding: FieldValue.vector(embedding) } : {}),
      created_at: Date.now(),
    });
    return NextResponse.json({ success: true, node_id: ref.id, embedded: !!embedding });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
