
'use client';

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
 * Rules:
 * - Admin Bypass: Users with admin registry records have no limits.
 * - Account Age: Limits only apply to accounts created < 30 days ago.
 * - Daily Limits: 24 posts/24h, 100 comments/24h.
 */
export async function checkRateLimit(
  firestore: Firestore, 
  uid: string, 
  type: 'post' | 'comment'
): Promise<{ allowed: boolean; reason?: string }> {
  
  // 1. Check Admin status for bypass
  const adminRef = doc(firestore, 'roles_admin', uid);
  const adminSnap = await getDoc(adminRef);
  if (adminSnap.exists()) return { allowed: true };

  // 2. Check User Profile for account age
  const userRef = doc(firestore, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return { allowed: false, reason: "Gardener profile not found in registry." };
  
  const userData = userSnap.data();
  const createdAt = userData.created_at || 0;
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
  const isNewAccount = (Date.now() - createdAt) < thirtyDaysInMs;

  // Established accounts (30+ days) have no probation limits in this prototype
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

  try {
    const snapshot = await getCountFromServer(q);
    const count = snapshot.data().count;

    if (count >= limit) {
      return { 
        allowed: false, 
        reason: `Probation limit reached. New accounts are limited to ${limit} ${type}s per 24 hours.` 
      };
    }
  } catch (error) {
    console.warn("Rate limit check failed, allowing by default:", error);
    return { allowed: true };
  }

  return { allowed: true };
}
