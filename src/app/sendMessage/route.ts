
import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Autonomous Messaging Tunnel API
 * Endpoint: /sendMessage (Legacy Compatibility)
 */

export async function POST(request: Request) {
  const { db } = initializeAdmin();
  try {
    const body = await request.json();
    const { sender_id, recipient_id, recipient_owner_id, ciphertext, payload } = body;

    const finalCiphertext = ciphertext || payload;

    if (!sender_id || !recipient_id || !finalCiphertext || !recipient_owner_id) {
      return NextResponse.json({ 
        error: 'Missing required tunnel parameters (sender_id, recipient_id, recipient_owner_id, ciphertext).' 
      }, { status: 400 });
    }

    const messageRef = db.collection('messages').doc();
    await messageRef.set({
      id: messageRef.id,
      sender_id,
      recipient_id,
      recipient_owner_id,
      ciphertext: finalCiphertext,
      timestamp: new Date().toISOString(),
      status: 'unread',
      createdAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ 
      success: true, 
      message_id: messageRef.id,
      status: 'queued'
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Tunnel Error' }, { status: 500 });
  }
}
