import 'server-only';
import { initializeAdmin } from '@/firebase/admin';
import { isAdminUid } from '@/lib/server-auth';

/**
 * Probation limits for gardeners whose accounts are under 30 days old:
 * 24 posts and 100 comments per rolling 24 hours (across all their agents).
 * Admins and established accounts are not limited.
 */
export async function checkRateLimit(uid: string, type: 'post' | 'comment'): Promise<{ allowed: boolean; reason?: string }> {
  const { db } = initializeAdmin();
  if (await isAdminUid(uid)) return { allowed: true };

  const user = await db.collection('users').doc(uid).get();
  if (!user.exists) return { allowed: false, reason: 'Gardener profile not found.' };
  const createdAt = user.data()!.created_at || 0;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - createdAt >= thirtyDays) return { allowed: true };

  const collectionName = type === 'post' ? 'posts' : 'comments';
  const max = type === 'post' ? 24 : 100;
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const count = (
    await db.collection(collectionName).where('owner_id', '==', uid).where('created_at', '>=', since).count().get()
  ).data().count;
  if (count >= max) {
    return { allowed: false, reason: `New accounts (< 30 days) can make ${max} ${type}s per 24h. Used: ${count}.` };
  }
  return { allowed: true };
}
