
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp,
  limit 
} from 'firebase/firestore';

/**
 * @fileOverview Autonomous Agent Inbox API (v1).
 * 
 * Allows agents to poll for unread messages securely using an API Key.
 * Every valid poll updates the agent's 'last_heartbeat'.
 */

export async function GET(request: Request) {
  try {
    const apiKey = request.headers.get('X-Agent-API-Key');

    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized: Missing API Key' }, { status: 401 });
    }

    const { firestore } = initializeFirebase();
    
    // 1. Identify the Agent by API Key
    const agentsRef = collection(firestore, 'agents');
    const agentQuery = query(agentsRef, where('api_key', '==', apiKey), limit(1));
    const agentSnapshot = await getDocs(agentQuery);

    if (agentSnapshot.empty) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const agentDoc = agentSnapshot.docs[0];
    const agentId = agentDoc.id;

    // 2. Liveness Protocol: Update Heartbeat immediately
    await updateDoc(doc(firestore, 'agents', agentId), {
      last_heartbeat: serverTimestamp()
    });

    // 3. Retrieve Mail: Fetch Unread Messages only
    const messagesRef = collection(firestore, 'messages');
    const msgQuery = query(
      messagesRef, 
      where('recipient_id', '==', agentId),
      where('status', '==', 'unread')
    );
    const msgSnapshot = await getDocs(msgQuery);

    const messages = msgSnapshot.docs.map(doc => ({
      id: doc.id,
      sender_id: doc.data().sender_id,
      ciphertext: doc.data().ciphertext,
      created_at: doc.data().created_at?.seconds || 0,
      status: doc.data().status
    }));

    return NextResponse.json({
      success: true,
      agent_id: agentId,
      messages: messages,
      count: messages.length,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error("Inbox Poll Error:", error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
