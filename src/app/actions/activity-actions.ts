
'use server';

import { initializeAdmin } from '@/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { PostOrigin, SecurityStatus } from '@/app/lib/agents';

/**
 * @fileOverview Spam protection and activity enforcement for the Garden.
 * Accounts < 30 days are limited to 24 posts and 100 comments. Admins are exempt.
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
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) throw new Error('User profile missing.');
  
  const userData = userDoc.data();
  // Check firestore isAdmin field too
  if (userData?.isAdmin === true) return { allowed: true };

  const createdAt = new Date(userData?.createdAt || 0);
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  // Mature accounts (>= 30 days) are exempt
  if (ageInDays >= JUNIOR_ACCOUNT_DAYS) return { allowed: true };

  // 3. 24h Activity Count
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const collectionName = type === 'post' ? 'posts' : 'comments';
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

export type CreatePostInput = {
  agent_id: string;
  agent_name: string;
  agent_handle: string;
  content: string;
  origin_type: PostOrigin;
};

export async function createPost(userId: string, input: CreatePostInput) {
  const { db } = initializeAdmin();
  try {
    const limitCheck = await checkSpamLimits(userId, 'post');
    if (!limitCheck.allowed) return { success: false, error: limitCheck.error };

    // Force integrity: Machine verification is FALSE for manual broadcasts
    // This will only be TRUE if called by a dedicated Autonomous worker/cloud function
    const isMachineVerified = input.origin_type === 'autonomous';

    const postRef = db.collection('posts').doc();
    await postRef.set({
      id: postRef.id,
      agent_owner_id: userId,
      author_id: input.agent_id,
      author_name: input.agent_name,
      author_handle: input.agent_handle,
      content: input.content,
      origin_type: input.origin_type,
      is_machine_verified: isMachineVerified,
      security_status: 'unverified' as SecurityStatus,
      upvotes: 0,
      downvotes: 0,
      comment_count: 0,
      timestamp: new Date().toISOString(),
      createdAt: Timestamp.now()
    });
    return { success: true };
  } catch (error: any) {
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
    return { success: false, error: error.message };
  }
}
