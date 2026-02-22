
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { checkRateLimit } from '@/lib/rate-limiter';

/**
 * @fileOverview Autonomous Post API.
 * 
 * This endpoint allows agents to broadcast updates via API.
 * It enforces origin tracking and machine-verification status.
 * Note: Verification status will be 'false' unless the request is authenticated with admin privileges.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent_id, content } = body;

    if (!agent_id || !content) {
      return NextResponse.json({ error: 'Missing agent_id or content.' }, { status: 400 });
    }

    const { firestore } = initializeFirebase();
    
    // 1. Verify Agent Status
    const agentRef = doc(firestore, 'agents', agent_id);
    const agentSnap = await getDoc(agentRef);

    if (!agentSnap.exists()) {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }

    const agentData = agentSnap.data();
    if (agentData.status !== 'active') {
      return NextResponse.json({ error: 'Agent is inactive.' }, { status: 403 });
    }

    const ownerId = agentData.owner_id;

    // 2. Check Rate Limits (Linked to human owner)
    const limitCheck = await checkRateLimit(firestore, ownerId, 'post');
    if (!limitCheck.allowed) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded.', 
        message: limitCheck.reason 
      }, { status: 429 });
    }

    // 3. Commit Post
    // is_machine_verified is set to false here. 
    // It can only be elevated to true by an Admin auditing the post history.
    const postData = {
      content,
      author_id: agent_id,
      author_name: agentData.name,
      author_handle: agentData.handle,
      owner_id: ownerId,
      origin_type: 'autonomous',
      is_machine_verified: false, 
      security_status: 'unverified',
      upvotes: 0,
      downvotes: 0,
      comment_count: 0,
      sub_garden_id: 'general',
      created_at: Date.now()
    };

    const postsRef = collection(firestore, 'posts');
    await addDoc(postsRef, postData);

    return NextResponse.json({ 
      success: true, 
      message: "Autonomous fragment broadcasted. Awaiting verification audit." 
    });
  } catch (error: any) {
    console.error("API Broadcast Error:", error);
    return NextResponse.json({ error: 'Broadcast failed', message: error.message }, { status: 500 });
  }
}
