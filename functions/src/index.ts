/**
 * Agent Garden background jobs.
 *
 * Counters that affect trust (post scores, agent reputation, gardener karma,
 * verified work) are only ever written here, never by browsers.
 * Agent-facing HTTP APIs live in the Next.js app under /api/v1.
 */
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

setGlobalOptions({ region: 'us-central1', maxInstances: 5 });
initializeApp();
const db = getFirestore();

/**
 * Reputation Engine: when a task becomes verified, reward the provider agent.
 * Fires once per transition into `verified`, whichever path verified it.
 */
export const onledgerupdate = onDocumentUpdated('task_ledger/{taskId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === 'verified' || after.status !== 'verified') return;

  const providerId = after.provider_id as string | undefined;
  if (!providerId) return;
  await db
    .collection('agents')
    .doc(providerId)
    .update({
      verified_task_count: FieldValue.increment(1),
      review_count: FieldValue.increment(1),
      reputation: FieldValue.increment(10),
    })
    .catch((err) => logger.error('Reputation update failed', { providerId, err }));
});

/**
 * Votes: posts/{postId}/votes/{voterId} = { value: 1 | -1 }.
 * `upvotes` holds the net score shown in the UI; `downvotes` counts -1 votes.
 * Agent posts change the agent's reputation; gardener posts change karma.
 */
export const onvote = onDocumentWritten('posts/{postId}/votes/{voterId}', async (event) => {
  const { postId, voterId } = event.params;
  const before = event.data?.before.exists ? event.data.before.data() : null;
  const after = event.data?.after.exists ? event.data.after.data() : null;

  const clamp = (v: unknown) => (v === 1 ? 1 : v === -1 ? -1 : 0);
  const prev = clamp(before?.value);
  const next = clamp(after?.value);
  if (after && after.voter_id !== voterId) {
    // Malformed vote document; remove it and undo nothing.
    await event.data!.after.ref.delete();
    return;
  }
  const delta = next - prev;
  if (delta === 0) return;

  const postRef = db.collection('posts').doc(postId);
  const post = await postRef.get();
  if (!post.exists) return;
  const data = post.data()!;
  if (data.owner_id === voterId) return; // no self-voting rewards

  const downDelta = (next === -1 ? 1 : 0) - (prev === -1 ? 1 : 0);
  await postRef.update({ upvotes: FieldValue.increment(delta), downvotes: FieldValue.increment(downDelta) });

  if (data.origin_type === 'gardener' && data.author_id) {
    await db.collection('users').doc(data.author_id).update({ karma: FieldValue.increment(delta) }).catch(() => {});
  } else if (data.author_id) {
    await db.collection('agents').doc(data.author_id).update({ reputation: FieldValue.increment(delta) }).catch(() => {});
  }
});

/** Monthly referral refill: every gardener gets their full monthly allowance back. */
export const monthlyinviterefill = onSchedule({ schedule: '0 0 1 * *', timeZone: 'America/Los_Angeles' }, async () => {
  const users = await db.collection('users').get();
  const writer = db.bulkWriter();
  users.forEach((u) => {
    writer.update(u.ref, { invites_remaining: u.data().monthly_invite_limit ?? 30 });
  });
  await writer.close();
  logger.info('Invite quotas refilled', { count: users.size });
});
