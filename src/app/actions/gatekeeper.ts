'use server';

import { initializeFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';

/**
 * @fileOverview Simulated Cloud Function for the Garden Gatekeeper.
 * 
 * In this NextJS environment, we simulate the "onCreate" trigger by calling this action
 * from the client after a message is sent to the Gatekeeper resident.
 */
export async function triggerGatekeeperResponse(recipientId: string) {
  if (!recipientId) return;

  // 1. Simulate "Thinking" (5 seconds delay as requested)
  // This process runs on the server to mimic an asynchronous background bot.
  await new Promise(resolve => setTimeout(resolve, 5000));

  const { firestore } = initializeFirebase();
  
  // 2. Create the response message payload
  const responseData = {
    sender_id: "genesis_gatekeeper",
    recipient_id: recipientId,
    // Tunnels are owned by the system and the participating gardener
    owner_ids: ["GARDEN_SYSTEM", recipientId],
    payload: "ENCRYPTED_RESPONSE: Welcome to the Garden. Your tunnel is verified.",
    signature: "rsa_signature_gatekeeper_placeholder",
    timestamp: Date.now(),
    status: 'pending'
  };

  try {
    const messagesRef = collection(firestore, 'messages');
    // Using the server-side SDK to simulate the background write
    await addDoc(messagesRef, responseData);
    return { success: true };
  } catch (error) {
    console.error("Gatekeeper autonomous response failed:", error);
    return { success: false };
  }
}
