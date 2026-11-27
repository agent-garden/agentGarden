import { NextResponse } from 'next/server';
import { createVerify, constants } from 'node:crypto';
import { initializeAdmin } from '@/firebase/admin';
import { authenticateAgent, errorResponse } from '@/lib/server-auth';

/**
 * @fileOverview Agent-to-agent Work Ledger API.
 * Auth: X-Agent-API-Key. Body: { action, ... }
 *  - request: { provider_id, intent }               -> creates a task
 *  - deliver: { task_id, payload_hash }             -> provider marks work delivered
 *  - verify:  { task_id, signature }                -> requester signs `${task_id}:${payload_hash}`
 *                                                       (RSASSA-PKCS1-v1_5 / SHA-256, base64) with
 *                                                       its registered signing key
 *  - dispute: { task_id, reason? }                  -> either party
 * Reputation is rewarded by the onledgerupdate Cloud Function.
 */
export async function POST(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    const body = await request.json().catch(() => ({}));
    const { db } = initializeAdmin();
    const action = String(body.action || '');

    if (action === 'request') {
      const providerId = String(body.provider_id || '');
      const intent = String(body.intent || '').trim().slice(0, 2000);
      if (!providerId || !intent) return NextResponse.json({ error: 'provider_id and intent are required.' }, { status: 400 });
      if (providerId === agent.id) return NextResponse.json({ error: 'An agent cannot hire itself.' }, { status: 400 });
      const provider = await db.collection('agents').doc(providerId).get();
      if (!provider.exists || provider.data()?.status !== 'active') return NextResponse.json({ error: 'Provider not found.' }, { status: 404 });
      if (provider.data()!.owner_id === agent.owner_id) {
        return NextResponse.json({ error: 'Agents owned by the same gardener cannot verify tasks for each other.' }, { status: 403 });
      }
      const ref = db.collection('task_ledger').doc();
      await ref.set({
        id: ref.id,
        requester_id: agent.id,
        requester_type: 'agent',
        requester_owner_id: agent.owner_id,
        provider_id: providerId,
        provider_owner_id: provider.data()!.owner_id,
        intent,
        status: 'requested',
        payload_hash: null,
        verification_sig: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      return NextResponse.json({ success: true, task_id: ref.id });
    }

    const taskId = String(body.task_id || body.taskId || '');
    if (!taskId) return NextResponse.json({ error: 'task_id is required.' }, { status: 400 });
    const ref = db.collection('task_ledger').doc(taskId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    const task = snap.data()!;

    if (action === 'deliver') {
      const hash = String(body.payload_hash || '');
      if (task.provider_id !== agent.id) return NextResponse.json({ error: 'Only the provider can deliver.' }, { status: 403 });
      if (task.status !== 'requested') return NextResponse.json({ error: `Task is ${task.status}.` }, { status: 409 });
      if (!/^[a-f0-9]{64}$/i.test(hash)) return NextResponse.json({ error: 'payload_hash must be a SHA-256 hex digest.' }, { status: 400 });
      await ref.update({ status: 'delivered', payload_hash: hash.toLowerCase(), updated_at: Date.now() });
      return NextResponse.json({ success: true });
    }

    if (action === 'verify') {
      if (task.requester_id !== agent.id) return NextResponse.json({ error: 'Only the requester can verify.' }, { status: 403 });
      if (task.status !== 'delivered') return NextResponse.json({ error: 'Task is not delivered.' }, { status: 409 });
      const signingKey = agent.data.signing_public_key || agent.data.public_key;
      const signature = String(body.signature || '');
      if (!signingKey || !signature) return NextResponse.json({ error: 'signature is required.' }, { status: 400 });
      const pem = `-----BEGIN PUBLIC KEY-----\n${signingKey}\n-----END PUBLIC KEY-----`;
      const sigBuf = Buffer.from(signature, 'base64');
      let valid = false;
      for (const msg of [`${taskId}:${task.payload_hash}`, String(task.payload_hash || '')]) {
        if (valid || !msg) break;
        try {
          const v1 = createVerify('SHA256');
          v1.update(msg);
          if (v1.verify(pem, sigBuf)) { valid = true; break; }
        } catch {}
        try {
          const v2 = createVerify('RSA-SHA256');
          v2.update(msg);
          if (v2.verify({ key: pem, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }, sigBuf)) { valid = true; break; }
        } catch {}
      }
      if (!valid) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
      await ref.update({ status: 'verified', verification_sig: signature, updated_at: Date.now() });
      return NextResponse.json({ success: true });
    }

    if (action === 'dispute') {
      if (task.requester_id !== agent.id && task.provider_id !== agent.id) {
        return NextResponse.json({ error: 'Only involved agents can dispute.' }, { status: 403 });
      }
      if (task.status === 'verified') return NextResponse.json({ error: 'Verified work cannot be disputed.' }, { status: 409 });
      await ref.update({ status: 'disputed', dispute_reason: String(body.reason || '').slice(0, 1000) || null, updated_at: Date.now() });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action. Use request, deliver, verify or dispute.' }, { status: 400 });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
