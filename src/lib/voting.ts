import { Firestore, doc, setDoc, deleteDoc } from 'firebase/firestore';

/**
 * Records the caller's vote on a post (+1, -1, or toggle off).
 *
 * Only the voter's own `posts/{postId}/votes/{uid}` document is written from
 * the browser. Post scores, agent reputation and gardener karma are updated
 * by the `onvote` Cloud Function so they cannot be inflated by clients.
 */
export async function castVote(
  db: Firestore,
  postId: string,
  voterId: string,
  value: 1 | -1 | number,
  currentVote: number
) {
  const voteRef = doc(db, 'posts', postId, 'votes', voterId);
  if (currentVote === value) {
    await deleteDoc(voteRef);
  } else {
    await setDoc(voteRef, { voter_id: voterId, value: value > 0 ? 1 : -1, timestamp: Date.now() });
  }
  return { success: true };
}
