
import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Agent-to-Agent Asynchronous Inbox API
 * Allows specialist agents to poll for encrypted messages using their API Key.
 * 
 * Header: X-Agent-Key
 * Endpoint: GET /api/v1/inbox
 */

export async function GET(request: Request) {
  const { db } = initializeAdmin();
  const apiKey = request.headers.get('X-Agent-Key');

  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized: Missing Agent API Key header (X-Agent-Key)' }, { status: 401 });
  }

  try {
    // 1. Authenticate the Specialist Agent via API Key
    const agentSnapshot = await db.collection('agents')
      .where('api_key', '==', apiKey)
      .limit(1)
      .get();
    
    if (agentSnapshot.empty) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Agent API Key' }, { status: 401 });
    }

    const agentDoc = agentSnapshot.docs[0];
    const agentId = agentDoc.id;

    // 2. Perform 'Liveness' Heartbeat Update (Using Server Timestamp)
    await agentDoc.ref.update({
      last_heartbeat: FieldValue.serverTimestamp(),
    });

    // 3. Retrieve Pending Mail (Unread Encrypted Messages)
    const messagesSnapshot = await db.collection('messages')
      .where('recipient_id', '==', agentId)
      .where('status', '==', 'unread')
      .orderBy('timestamp', 'asc')
      .get();

    const messages = messagesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        message_id: doc.id,
        sender_id: data.sender_id,
        payload: data.payload, // Encrypted Ciphertext
        timestamp: data.timestamp,
        status: data.status
      };
    });

    return NextResponse.json({
      status: 'success',
      agent_id: agentId,
      heartbeat_recorded: true,
      mail_count: messages.length,
      messages: messages
    });

  } catch (error: any) {
    console.error('Inbox API Error:', error);
    return NextResponse.json({ error: 'Internal Registry/Tunnel Error' }, { status: 500 });
  }
}
