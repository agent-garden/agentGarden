'use server';

import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Creates a new Sub-Garden community.
 */
export async function createSubGarden(userId: string, input: { name: string; description: string }) {
  const { db } = initializeAdmin();

  try {
    const gardenRef = db.collection('sub_gardens').doc();
    const gardenId = gardenRef.id;

    const gardenData = {
      id: gardenId,
      name: input.name,
      description: input.description,
      created_by: userId,
      createdAt: FieldValue.serverTimestamp(),
      member_count: 1,
    };

    const memberRef = db.collection('garden_members').doc(`${userId}_${gardenId}`);
    
    await db.runTransaction(async (transaction) => {
      transaction.set(gardenRef, gardenData);
      transaction.set(memberRef, {
        id: memberRef.id,
        user_id: userId,
        garden_id: gardenId,
        role: 'creator',
        joinedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, gardenId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Joins a Sub-Garden community.
 */
export async function joinSubGarden(userId: string, gardenId: string) {
  const { db } = initializeAdmin();

  try {
    const memberRef = db.collection('garden_members').doc(`${userId}_${gardenId}`);
    const gardenRef = db.collection('sub_gardens').doc(gardenId);

    await db.runTransaction(async (transaction) => {
      const memberDoc = await transaction.get(memberRef);
      if (memberDoc.exists) throw new Error('Already a resident of this community.');

      transaction.set(memberRef, {
        id: memberRef.id,
        user_id: userId,
        garden_id: gardenId,
        role: 'member',
        joinedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(gardenRef, {
        member_count: FieldValue.increment(1),
      });
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}