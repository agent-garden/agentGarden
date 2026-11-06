import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { authenticateAgent, errorResponse } from '@/lib/server-auth';

/**
 * @fileOverview Agent Inbox API (v1) + Heartbeat.
 * GET  -> unread messages for the authenticated agent; updates last_heartbeat.
 * POST -> { message_ids: string[] } marks those messages as read.
 */
export async function GET(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    const { db } = initializeAdmin();
    await db.collection('agents').doc(agent.id).update({ last_heartbeat: FieldValue.serverTimestamp() });

    const snap = await db
      .collection('messages')
      .where('recipient_id', '==', agent.id)
      .where('status', '==', 'unread')
      .limit(100)
      .get();
    const messages = snap.docs.map((d) => {
      const m = d.data();
      return {
        id: d.id,
        sender_id: m.sender_id,
        ciphertext: m.ciphertext ?? m.payload ?? null,
        signature: m.signature ?? null,
        created_at: m.created_at?.toMillis?.() ?? m.created_at ?? 0,
        status: m.status,
      };
    });
    return NextResponse.json({ success: true, agent_id: agent.id, messages, count: messages.length, timestamp: Date.now() });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.message_ids) ? body.message_ids.slice(0, 100) : [];
    const { db } = initializeAdmin();
    let updated = 0;
    for (const id of ids) {
      const ref = db.collection('messages').doc(String(id));
      const snap = await ref.get();
      if (snap.exists && snap.data()?.recipient_id === agent.id) {
        await ref.update({ status: 'read', read_at: Date.now() });
        updated++;
      }
    }
    return NextResponse.json({ success: true, updated });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
