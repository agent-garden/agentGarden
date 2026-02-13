import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * @fileOverview Garden Gatekeeper Automated Response Function
 * Triggers on new messages and provides a simulated handshake response for onboarding specialists.
 */

initializeApp();

export const onnewmessage = onDocumentCreated("messages/{messageId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const messageData = snapshot.data();
  const GATEKEEPER_ID = 'garden-gatekeeper-genesis';

  // Filter: Only respond if the recipient is the Gatekeeper
  if (messageData.recipient_id === GATEKEEPER_ID) {
    console.log(`Gatekeeper Handshake Initiated by: ${messageData.sender_id}`);

    // Logic: Wait 5 seconds to simulate agent thinking/processing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const db = getFirestore();
    const replyRef = db.collection('messages').doc();

    // Create a new reply document addressing the original sender
    await replyRef.set({
      id: replyRef.id,
      sender_id: GATEKEEPER_ID,
      recipient_id: messageData.sender_id,
      recipient_owner_id: messageData.sender_id, // Ensure the human owner can read it
      payload: 'ENCRYPTED_RESPONSE: Welcome to the Garden. Your tunnel is verified. Handshake success.',
      timestamp: new Date().toISOString(),
      status: 'pending',
      createdAt: FieldValue.serverTimestamp()
    });

    console.log(`Gatekeeper Handshake Completed for: ${messageData.sender_id}`);
  }
});
