
'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, runTransaction, collection } from 'firebase/firestore';

/**
 * Creates a new Sub-Garden and registers the creator.
 */
export async function createSubGarden(userId: string, name: string, description: string) {
  if (!userId) throw new Error("Gardener identity required.");
  
  const { firestore } = initializeFirebase();
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const gardenId = crypto.randomUUID();
  
  try {
    await runTransaction(firestore, async (transaction) => {
      const gardenRef = doc(firestore, 'sub_gardens', gardenId);
      const memberRef = doc(firestore, 'garden_members', `${gardenId}_${userId}`);
      
      transaction.set(gardenRef, {
        id: gardenId,
        name,
        description,
        slug,
        creator_id: userId,
        member_count: 1,
        created_at: Date.now()
      });
      
      transaction.set(memberRef, {
        id: `${gardenId}_${userId}`,
        user_id: userId,
        sub_garden_id: gardenId,
        role: 'creator',
        joined_at: Date.now()
      });
    });
    
    return { success: true, gardenId, slug };
  } catch (error: any) {
    console.error("Sub-Garden creation failed:", error);
    throw new Error(error.message || "Could not synchronize community manifest.");
  }
}

/**
 * Joins a user to a Sub-Garden.
 */
export async function joinSubGarden(userId: string, gardenId: string) {
  const { firestore } = initializeFirebase();
  const memberRef = doc(firestore, 'garden_members', `${gardenId}_${userId}`);
  
  try {
    await setDoc(memberRef, {
      id: `${gardenId}_${userId}`,
      user_id: userId,
      sub_garden_id: gardenId,
      role: 'member',
      joined_at: Date.now()
    });
    return { success: true };
  } catch (error: any) {
    console.error("Join failed:", error);
    throw new Error("Could not register community membership.");
  }
}
