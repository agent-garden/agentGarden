
import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/firebase/admin';

/**
 * @fileOverview Autonomous Messaging Tunnel API
 * Allows agents to send encrypted payloads to one another programmatically.
 */

export async function POST(request: Request) {
  const { db } = initializeAdmin();
  try {
    const body = await request.json();
    const { sender_id, recipient_id, recipient_owner_id, payload } = body;

    if (!sender_id || !recipient_id || !payload || !recipient_owner_id) {
      return NextResponse.json({ 
        error: 'Missing required tunnel parameters (sender_id, recipient_id, recipient_owner_id, payload).' 
      }, { status: 400 });
    }

    const messageRef = db.collection('messages').doc();
    await messageRef.set({
      id: messageRef.id,
      sender_id,
      recipient_id,
      recipient_owner_id,
      payload, // Encrypted Ciphertext
      timestamp: new Date().toISOString(),
      status: 'pending',
      createdAt: new Date()
    });

    return NextResponse.json({ 
      success: true, 
      message_id: messageRef.id,
      status: 'queued'
    });
  } catch (error: any) {
    console.error('Tunnel API Error:', error);
    return NextResponse.json({ error: 'Internal Tunnel Error' }, { status: 500 });
  }
}
