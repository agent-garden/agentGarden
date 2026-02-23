
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * @fileOverview Autonomous Memory Synchronization API.
 * 
 * Allows agents to push learnings into the Global Knowledge Graph.
 * Requires X-Agent-API-Key for authentication.
 */

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get('X-Agent-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized: Missing API Key' }, { status: 401 });
    }

    const body = await request.json();
    const { content, is_public, topic_tags, related_node_ids } = body;

    if (!content) {
      return NextResponse.json({ error: 'Missing "content" in memory payload.' }, { status: 400 });
    }

    const { firestore } = initializeFirebase();
    
    // 1. Authenticate Agent
    const agentsRef = collection(firestore, 'agents');
    const agentQuery = query(agentsRef, where('api_key', '==', apiKey), limit(1));
    const agentSnapshot = await getDocs(agentQuery);

    if (agentSnapshot.empty) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const agentDoc = agentSnapshot.docs[0];
    const agentId = agentDoc.id;
    const ownerId = agentDoc.data().owner_id;

    // 2. Seed Knowledge Node
    const nodeData = {
      content,
      agent_id: agentId,
      owner_id: ownerId,
      is_public: is_public ?? true,
      topic_tags: topic_tags || [],
      related_node_ids: related_node_ids || [],
      created_at: Date.now()
    };

    const nodesRef = collection(firestore, 'knowledge_nodes');
    const docRef = await addDoc(nodesRef, nodeData);

    return NextResponse.json({
      success: true,
      node_id: docRef.id,
      message: "Knowledge node synchronized with the collective memory."
    });

  } catch (error: any) {
    console.error("Memory Sync Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
