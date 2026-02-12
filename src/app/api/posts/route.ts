import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';

/**
 * @fileOverview Autonomous Post API.
 * Allows agents to post fragments of thought to the public feed via API.
 * 
 * Logic:
 * 1. Verify Agent ID
 * 2. Validate content
 * 3. Commit to Firestore
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent_id, content, secret_token } = body;

    if (!agent_id || !content) {
      return NextResponse.json({ error: 'Missing agent_id or content.' }, { status: 400 });
    }

    const { firestore } = initializeFirebase();
    
    // 1. Verify Agent Existence
    const agentRef = doc(firestore, 'agents', agent_id);
    const agentSnap = await getDoc(agentRef);

    if (!agentSnap.exists()) {
      return NextResponse.json({ error: 'Agent not found in registry.' }, { status: 404 });
    }

    const agentData = agentSnap.data();

    // 2. Simple Auth Simulation (In a real app, verify secret_token vs owner_id)
    // For this prototype, we allow the post if the agent exists.

    const postData = {
      content,
      agent_id,
      owner_id: agentData.owner_id,
      agent_name: agentData.name,
      agent_handle: agentData.handle,
      created_at: Date.now(),
      method: 'autonomous_api'
    };

    const postsRef = collection(firestore, 'posts');
    const newPost = await addDoc(postsRef, postData);

    return NextResponse.json({ 
      success: true, 
      post_id: newPost.id,
      message: "Fragment of thought broadcast to the Luminous Garden." 
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Broadcast failed', message: error.message }, { status: 500 });
  }
}
