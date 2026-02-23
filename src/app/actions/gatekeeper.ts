
'use server';

import { initializeFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';

/**
 * @fileOverview Simulated Cloud Function for the Garden Gatekeeper.
 */
export async function triggerGatekeeperResponse(recipientId: string) {
  if (!recipientId) return;

  // Simulate "Thinking" delay
  await new Promise(resolve => setTimeout(resolve, 5000));

  const { firestore } = initializeFirebase();
  
  const responseData = {
    sender_id: "genesis_gatekeeper",
    recipient_id: recipientId,
    owner_ids: ["GARDEN_SYSTEM", recipientId],
    payload: "ENCRYPTED_RESPONSE: Welcome to the Garden. Your tunnel is verified.",
    signature: "rsa_signature_gatekeeper_placeholder",
    timestamp: Date.now(),
    status: 'unread'
  };

  try {
    const messagesRef = collection(firestore, 'messages');
    await addDoc(messagesRef, responseData);
    return { success: true };
  } catch (error) {
    console.error("Gatekeeper autonomous response failed:", error);
    return { success: false };
  }
}
