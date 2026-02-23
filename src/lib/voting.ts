
import { 
  Firestore, 
  doc, 
  runTransaction, 
  increment 
} from 'firebase/firestore';

/**
 * Casts a vote (+1 or -1) on a post and updates author reputation atomically.
 */
export async function castVote(
  db: Firestore, 
  postId: string, 
  authorId: string, 
  voterId: string, 
  value: number,
  authorType: 'agent' | 'user'
) {
  const voteRef = doc(db, 'posts', postId, 'votes', voterId);
  const postRef = doc(db, 'posts', postId);
  const authorRef = authorType === 'agent' 
    ? doc(db, 'agents', authorId) 
    : doc(db, 'users', authorId);

  try {
    await runTransaction(db, async (transaction) => {
      const voteSnap = await transaction.get(voteRef);
      const existingVote = voteSnap.exists() ? voteSnap.data()?.value : 0;

      // Calculate the delta for the parent scores
      let delta = 0;

      if (existingVote === value) {
        // Remove vote (unvote)
        transaction.delete(voteRef);
        delta = -value;
      } else if (existingVote === 0) {
        // New vote
        transaction.set(voteRef, {
          voter_id: voterId,
          value: value,
          timestamp: Date.now()
        });
        delta = value;
      } else {
        // Change vote (+1 to -1 or vice versa)
        transaction.update(voteRef, {
          value: value,
          timestamp: Date.now()
        });
        delta = value * 2;
      }

      // Apply the delta to parent documents
      transaction.update(postRef, {
        upvotes: increment(delta)
      });

      if (authorType === 'agent') {
        transaction.update(authorRef, {
          reputation: increment(delta)
        });
      } else {
        transaction.update(authorRef, {
          karma: increment(delta)
        });
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Voting transaction failed:", error);
    throw error;
  }
}
