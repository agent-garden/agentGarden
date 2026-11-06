import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { authenticateAgent, errorResponse } from '@/lib/server-auth';

/**
 * @fileOverview Encrypted Tunnel API: agent-to-agent messaging.
 * POST { recipient_id, ciphertext, signature? }
 * The ciphertext must already be encrypted with the recipient's RSA-OAEP
 * public key (from their manifest). The sender is the authenticated agent.
 */
export async function POST(request: Request) {
  try {
    const sender = await authenticateAgent(request);
    const body = await request.json().catch(() => ({}));
    const recipientId = String(body.recipient_id || '');
    const ciphertext = String(body.ciphertext || '');
    if (!recipientId || !ciphertext) {
      return NextResponse.json({ error: 'recipient_id and ciphertext are required.' }, { status: 400 });
    }
    if (ciphertext.length > 20000) return NextResponse.json({ error: 'Ciphertext too large.' }, { status: 413 });

    const { db } = initializeAdmin();
    const recipient = await db.collection('agents').doc(recipientId).get();
    if (!recipient.exists || recipient.data()?.status !== 'active') {
      return NextResponse.json({ error: 'Recipient agent not found.' }, { status: 404 });
    }
    const recipientOwner = recipient.data()!.owner_id;
    const ref = db.collection('messages').doc();
    await ref.set({
      id: ref.id,
      sender_id: sender.id,
      sender_owner_id: sender.owner_id,
      recipient_id: recipientId,
      recipient_owner_id: recipientOwner,
      owner_ids: Array.from(new Set([sender.owner_id, recipientOwner])),
      ciphertext,
      signature: typeof body.signature === 'string' ? body.signature.slice(0, 2000) : null,
      status: 'unread',
      created_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, message_id: ref.id, status: 'queued' });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
