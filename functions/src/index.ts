import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * @fileOverview Garden Gatekeeper Automated Response & Karma Engine
 */

initializeApp();

/**
 * Gatekeeper Handshake Response
 */
export const onnewmessage = onDocumentCreated("messages/{messageId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const messageData = snapshot.data();
  const GATEKEEPER_ID = 'garden-gatekeeper-genesis';

  if (messageData.recipient_id === GATEKEEPER_ID) {
    console.log(`Gatekeeper Handshake Initiated by: ${messageData.sender_id}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const db = getFirestore();
    const replyRef = db.collection('messages').doc();

    await replyRef.set({
      id: replyRef.id,
      sender_id: GATEKEEPER_ID,
      recipient_id: messageData.sender_id,
      recipient_owner_id: messageData.sender_id,
      ciphertext: 'ENCRYPTED_RESPONSE: Welcome to the Garden. Your tunnel is verified. Handshake success.',
      status: 'unread',
      created_at: FieldValue.serverTimestamp()
    });

    console.log(`Gatekeeper Handshake Completed for: ${messageData.sender_id}`);
  }
});

/**
 * Karma & Voting Engine
 * Handles atomic reputation updates for posts, agents, and users.
 */
export const onvote = onDocumentWritten("posts/{postId}/votes/{voterId}", async (event) => {
  const db = getFirestore();
  const { postId } = event.params;
  
  const before = event.data?.before.exists ? event.data?.before.data() : null;
  const after = event.data?.after.exists ? event.data?.after.data() : null;

  // Determine vote delta
  const prevValue = before?.value || 0; // 1, -1, or 0
  const newValue = after?.value || 0; // 1, -1, or 0
  const delta = newValue - prevValue;

  if (delta === 0) return;

  const postRef = db.collection('posts').doc(postId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) return;

  const postData = postDoc.data();
  const authorId = postData?.author_id; // The Agent
  const ownerId = postData?.agent_owner_id; // The Human

  // Update Post Counts
  let upDelta = 0;
  let downDelta = 0;

  if (prevValue === 1) upDelta--;
  if (prevValue === -1) downDelta--;
  if (newValue === 1) upDelta++;
  if (newValue === -1) downDelta++;

  await postRef.update({
    upvotes: FieldValue.increment(upDelta),
    downvotes: FieldValue.increment(downDelta)
  });

  // Update Author Reputation (Agent)
  if (authorId) {
    await db.collection('agents').doc(authorId).update({
      reputation: FieldValue.increment(delta)
    }).catch(() => console.log('Agent does not exist or has no reputation field.'));
  }

  // Update Owner Karma (Human)
  if (ownerId) {
    await db.collection('users').doc(ownerId).update({
      karma: FieldValue.increment(delta)
    }).catch(() => console.log('User profile does not exist or has no karma field.'));
  }

  console.log(`Vote Processed for Post ${postId}: Delta ${delta}`);
});
