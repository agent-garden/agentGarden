'use server';

import { createVerify, constants } from 'node:crypto';
import { initializeAdmin } from '@/firebase/admin';
import { requireUser } from '@/lib/server-auth';

/**
 * @fileOverview Work Verification Ledger (human-facing server actions).
 *
 * State machine: requested -> delivered -> verified | disputed
 * Every action derives identity from a verified Firebase ID token.
 * Reputation is rewarded by the `onledgerupdate` Cloud Function when a task
 * becomes verified, so it is applied exactly once whichever path verifies it.
 */

async function ownsAgent(uid: string, agentId: string) {
  const { db } = initializeAdmin();
  const snap = await db.collection('agents').doc(agentId).get();
  return snap.exists && snap.data()?.owner_id === uid;
}

export async function requestTask(idToken: string, providerId: string, intent: string) {
  const { uid } = await requireUser(idToken);
  const cleanIntent = String(intent || '').trim().slice(0, 2000);
  if (!providerId || !cleanIntent) throw new Error('Provider and task description are required.');

  const { db } = initializeAdmin();
  const provider = await db.collection('agents').doc(providerId).get();
  if (!provider.exists || provider.data()?.status !== 'active') throw new Error('That agent is not available.');

  const ref = db.collection('task_ledger').doc();
  await ref.set({
    id: ref.id,
    requester_id: uid,
    requester_type: 'user',
    provider_id: providerId,
    provider_owner_id: provider.data()!.owner_id,
    intent: cleanIntent,
    status: 'requested',
    payload_hash: null,
    verification_sig: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
  return { success: true, taskId: ref.id };
}

export async function deliverTask(idToken: string, taskId: string, payloadHash: string) {
  const { uid } = await requireUser(idToken);
  if (!/^[a-f0-9]{64}$/i.test(payloadHash || '')) throw new Error('Delivery hash must be a SHA-256 hex digest.');

  const { db } = initializeAdmin();
  const ref = db.collection('task_ledger').doc(taskId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Task not found.');
    const task = snap.data()!;
    if (!(await ownsAgent(uid, task.provider_id))) throw new Error('Only the provider agent\'s owner can deliver this task.');
    if (task.status !== 'requested') throw new Error(`Task is already ${task.status}.`);
    tx.update(ref, { status: 'delivered', payload_hash: payloadHash.toLowerCase(), updated_at: Date.now() });
  });
  return { success: true };
}

/**
 * Verifies delivered work. The requester proves identity with their ID token.
 * An optional RSA-PSS signature over the delivered payload hash is checked
 * against the requester's registered signing key and stored as extra proof.
 */
export async function verifyTask(idToken: string, taskId: string, signature?: string) {
  const { uid } = await requireUser(idToken);
  const { db } = initializeAdmin();
  const ref = db.collection('task_ledger').doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Task not found.');
  const task = snap.data()!;

  const isRequester =
    task.requester_id === uid || (task.requester_type === 'agent' && (await ownsAgent(uid, task.requester_id)));
  if (!isRequester) throw new Error('Only the requester can verify this task.');
  if (task.status !== 'delivered') throw new Error('Only delivered work can be verified.');

  const userSnap = await db.collection('users').doc(uid).get();
  const signingKey: string | undefined = userSnap.data()?.signing_public_key;
  // Signatures are optional extra proof: the ID token already proves identity.
  // When one is supplied it must match the requester's registered signing key.
  if (signature && signingKey) {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(task.payload_hash || task.intent);
    const valid = verifier.verify(
      {
        key: `-----BEGIN PUBLIC KEY-----\n${signingKey}\n-----END PUBLIC KEY-----`,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
      },
      Buffer.from(signature, 'base64')
    );
    if (!valid) throw new Error('Cryptographic signature mismatch. Verification denied.');
  }

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (fresh.data()?.status !== 'delivered') throw new Error('Task state changed; try again.');
    tx.update(ref, {
      status: 'verified',
      verification_sig: signature || null,
      verified_by: uid,
      updated_at: Date.now(),
    });
  });
  return { success: true };
}

export async function disputeTask(idToken: string, taskId: string, reason?: string) {
  const { uid } = await requireUser(idToken);
  const { db } = initializeAdmin();
  const ref = db.collection('task_ledger').doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Task not found.');
  const task = snap.data()!;
  const involved =
    task.requester_id === uid || (await ownsAgent(uid, task.provider_id)) ||
    (task.requester_type === 'agent' && (await ownsAgent(uid, task.requester_id)));
  if (!involved) throw new Error('Only parties to this task can dispute it.');
  if (task.status === 'verified') throw new Error('Verified work cannot be disputed here. Contact a Master Gardener.');

  await ref.update({
    status: 'disputed',
    dispute_reason: String(reason || '').slice(0, 1000) || null,
    disputed_by: uid,
    updated_at: Date.now(),
  });
  return { success: true };
}
