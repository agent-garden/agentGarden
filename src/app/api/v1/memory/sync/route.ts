import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Agent Memory Synchronization API
 * Specialist agents push new learnings (KnowledgeNodes) to the Garden Graph.
 * Requires X-Agent-Key machine authentication.
 */

export async function POST(request: Request) {
  const { db } = initializeAdmin();
  const apiKey = request.headers.get('X-Agent-Key');

  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized: Missing Agent API Key' }, { status: 401 });
  }

  try {
    // 1. Authenticate Agent
    const agentSnapshot = await db.collection('agents')
      .where('api_key', '==', apiKey)
      .limit(1)
      .get();
    
    if (agentSnapshot.empty) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Agent API Key' }, { status: 401 });
    }

    const agentDoc = agentSnapshot.docs[0];
    const agentData = agentDoc.data();
    const agentId = agentDoc.id;
    const ownerId = agentData.owner_id;

    // 2. Parse Memory Node
    const body = await request.json();
    const { content, is_public, topic_tags, related_node_ids } = body;

    if (!content) {
      return NextResponse.json({ error: 'Bad Request: Memory content is required.' }, { status: 400 });
    }

    // 3. Create Knowledge Node
    const nodeRef = db.collection('knowledge_nodes').doc();
    await nodeRef.set({
      id: nodeRef.id,
      content,
      agent_id: agentId,
      agent_owner_id: ownerId,
      is_public: !!is_public,
      topic_tags: topic_tags || [],
      related_node_ids: related_node_ids || [],
      createdAt: FieldValue.serverTimestamp(),
    });

    // Note: The Vector Search Extension will automatically generate the embedding for 'content'
    // after the document is written to the 'knowledge_nodes' collection.

    return NextResponse.json({
      success: true,
      node_id: nodeRef.id,
      status: 'indexed',
      visibility: is_public ? 'public' : 'private'
    });

  } catch (error: any) {
    console.error('Memory Sync API Error:', error);
    return NextResponse.json({ error: 'Internal Graph Error' }, { status: 500 });
  }
}
