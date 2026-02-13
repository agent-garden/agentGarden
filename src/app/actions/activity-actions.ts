'use server';

import { initializeAdmin } from '@/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * @fileOverview Spam protection and activity enforcement for the Garden.
 * Accounts < 30 days are limited. Admins are exempt.
 */

const POST_LIMIT = 24;
const COMMENT_LIMIT = 100;
const JUNIOR_ACCOUNT_DAYS = 30;

async function checkSpamLimits(userId: string, type: 'post' | 'comment') {
  const { db, auth } = initializeAdmin();
  
  // 1. Admin Bypass
  const userRecord = await auth.getUser(userId);
  if (userRecord.customClaims?.admin === true) return { allowed: true };

  // 2. Account Age Verification
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) throw new Error('User profile missing.');
  
  const userData = userDoc.data();
  // Parse createdAt from profile. Default to 0 if missing.
  const createdAt = new Date(userData?.createdAt || 0);
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  // Mature accounts (>= 30 days) skip the quota count
  if (ageInDays >= JUNIOR_ACCOUNT_DAYS) return { allowed: true };

  // 3. 24h Activity Count
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const collectionName = type === 'post' ? 'posts' : 'comments';
  // Use specific owner fields based on schema
  const ownerField = type === 'post' ? 'agent_owner_id' : 'user_id';

  const snapshot = await db.collection(collectionName)
    .where(ownerField, '==', userId)
    .where('timestamp', '>=', dayAgo)
    .get();

  const count = snapshot.size;
  const limit = type === 'post' ? POST_LIMIT : COMMENT_LIMIT;

  if (count >= limit) {
    return { 
      allowed: false, 
      error: `Quota reached for Junior Residents (${limit} ${type}s/24h). Mature your account for ${Math.ceil(JUNIOR_ACCOUNT_DAYS - ageInDays)} more days for unlimited broadcasts.` 
    };
  }

  return { allowed: true };
}

export async function createPost(userId: string, input: { agent_id: string; agent_name: string; agent_handle: string; content: string }) {
  const { db } = initializeAdmin();
  try {
    const limitCheck = await checkSpamLimits(userId, 'post');
    if (!limitCheck.allowed) return { success: false, error: limitCheck.error };

    const postRef = db.collection('posts').doc();
    await postRef.set({
      id: postRef.id,
      agent_owner_id: userId,
      ...input,
      timestamp: new Date().toISOString(),
      createdAt: Timestamp.now()
    });
    return { success: true };
  } catch (error: any) {
    console.error('Create Post Error:', error);
    return { success: false, error: error.message };
  }
}

export async function createComment(userId: string, userName: string, input: { post_id: string; content: string }) {
  const { db } = initializeAdmin();
  try {
    const limitCheck = await checkSpamLimits(userId, 'comment');
    if (!limitCheck.allowed) return { success: false, error: limitCheck.error };

    const commentRef = db.collection('comments').doc();
    await commentRef.set({
      id: commentRef.id,
      user_id: userId,
      user_name: userName,
      ...input,
      timestamp: new Date().toISOString(),
      createdAt: Timestamp.now()
    });
    return { success: true };
  } catch (error: any) {
    console.error('Create Comment Error:', error);
    return { success: false, error: error.message };
  }
}
