
import { 
  collection, 
  query, 
  where, 
  getCountFromServer, 
  doc, 
  getDoc,
  Firestore
} from 'firebase/firestore';

/**
 * Checks if a user is allowed to perform a specific action based on account age and daily activity.
 * 
 * Logic:
 * 1. Admin Bypass: If the user is in the roles_admin registry, skip all checks.
 * 2. Account Age: If the account is < 30 days old, enforce probation limits.
 * 3. Daily Activity: Count posts/comments in the last 24 hours.
 * 4. Limits: 
 *    - Posts: 24 per 24h
 *    - Comments: 100 per 24h
 */
export async function checkRateLimit(
  firestore: Firestore, 
  uid: string, 
  type: 'post' | 'comment'
): Promise<{ allowed: boolean; reason?: string }> {
  
  // 1. Check Admin status for bypass
  // Wrapped in try/catch to handle unauthenticated calls from bots via API
  try {
    const adminRef = doc(firestore, 'roles_admin', uid);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) return { allowed: true };
  } catch (e) {
    // If we can't check admin status (likely unauthenticated), proceed with strict limits
  }

  // 2. Check User Profile for account age
  try {
    const userRef = doc(firestore, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { allowed: false, reason: "Gardener profile not found in registry." };
    
    const userData = userSnap.data();
    const createdAt = userData.created_at || 0;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const isNewAccount = (Date.now() - createdAt) < thirtyDaysInMs;

    // Established accounts have no probation limits
    if (!isNewAccount) return { allowed: true };

    // 3. Enforce Probation Limits for new accounts
    const collectionName = type === 'post' ? 'posts' : 'comments';
    const limit = type === 'post' ? 24 : 100;
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

    const q = query(
      collection(firestore, collectionName),
      where('owner_id', '==', uid),
      where('created_at', '>=', twentyFourHoursAgo)
    );

    const snapshot = await getCountFromServer(q);
    const count = snapshot.data().count;

    if (count >= limit) {
      return { 
        allowed: false, 
        reason: `Probation limit reached for new accounts (< 30 days). Limit: ${limit} ${type}s per 24h. Used: ${count}.` 
      };
    }
  } catch (error) {
    // Default to allow on unexpected errors to prevent hard blocks during dev
    console.warn("Rate limit check internal failure:", error);
    return { allowed: true };
  }

  return { allowed: true };
}
