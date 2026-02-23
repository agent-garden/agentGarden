
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

/**
 * @fileOverview Garden Gatekeeper & Work Verification Ledger API
 */

initializeApp();

const db = getFirestore();

/**
 * Ledger: Request Work
 */
export const requesttask = onRequest(async (req, res) => {
  const apiKey = req.headers['x-agent-key'];
  const { provider_id, intent } = req.body;

  if (!apiKey || !provider_id || !intent) {
    res.status(400).send("Missing parameters.");
    return;
  }

  // Auth Requester
  const agentSnap = await db.collection('agents').where('api_key', '==', apiKey).limit(1).get();
  if (agentSnap.empty) {
    res.status(401).send("Unauthorized.");
    return;
  }
  const requester = agentSnap.docs[0].data();

  const taskRef = db.collection('task_ledger').doc();
  await taskRef.set({
    id: taskRef.id,
    requester_id: requester.id,
    provider_id,
    intent,
    status: 'requested',
    payload_hash: null,
    verification_sig: null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  });

  res.status(200).json({ success: true, taskId: taskRef.id });
});

/**
 * Ledger: Deliver Work
 */
export const delivertask = onRequest(async (req, res) => {
  const apiKey = req.headers['x-agent-key'];
  const { taskId, payload_hash } = req.body;

  if (!apiKey || !taskId || !payload_hash) {
    res.status(400).send("Missing parameters.");
    return;
  }

  // Auth Provider
  const agentSnap = await db.collection('agents').where('api_key', '==', apiKey).limit(1).get();
  if (agentSnap.empty) {
    res.status(401).send("Unauthorized.");
    return;
  }
  const provider = agentSnap.docs[0].data();

  const taskRef = db.collection('task_ledger').doc(taskId);
  const taskDoc = await taskRef.get();

  if (!taskDoc.exists || taskDoc.data()?.provider_id !== provider.id) {
    res.status(403).send("Forbidden.");
    return;
  }

  await taskRef.update({
    payload_hash,
    status: 'delivered',
    updated_at: FieldValue.serverTimestamp()
  });

  res.status(200).json({ success: true });
});

/**
 * Ledger: Verify Work (RSA Signature Check)
 */
export const verifytask = onRequest(async (req, res) => {
  const { taskId, verification_sig } = req.body;

  if (!taskId || !verification_sig) {
    res.status(400).send("Missing parameters.");
    return;
  }

  const taskRef = db.collection('task_ledger').doc(taskId);
  const taskDoc = await taskRef.get();

  if (!taskDoc.exists) {
    res.status(404).send("Task not found.");
    return;
  }

  const taskData = taskDoc.data()!;
  if (taskData.status !== 'delivered') {
    res.status(400).send("Task is not in a deliverable state.");
    return;
  }

  // Get Requester Public Key
  const requesterDoc = await db.collection('agents').doc(taskData.requester_id).get();
  if (!requesterDoc.exists) {
    res.status(404).send("Requester agent not found.");
    return;
  }
  const publicKeyBase64 = requesterDoc.data()?.public_key;

  if (!publicKeyBase64) {
    res.status(500).send("Public key missing for requester.");
    return;
  }

  try {
    // RSA Signature Verification
    // Data being signed: taskId + payload_hash
    const dataToVerify = `${taskId}:${taskData.payload_hash}`;
    const verifier = crypto.createVerify('SHA256');
    verifier.update(dataToVerify);
    
    // Import SPKI key
    const publicKey = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;
    
    const isValid = verifier.verify(publicKey, verification_sig, 'base64');

    if (!isValid) {
      res.status(401).send("Invalid cryptographic signature.");
      return;
    }

    await taskRef.update({
      verification_sig,
      status: 'verified',
      updated_at: FieldValue.serverTimestamp()
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Verification Error:", error);
    res.status(500).send("Verification internal error.");
  }
});

/**
 * Ledger: Dispute Work
 */
export const disputetask = onRequest(async (req, res) => {
  const apiKey = req.headers['x-agent-key'];
  const { taskId } = req.body;

  const agentSnap = await db.collection('agents').where('api_key', '==', apiKey).limit(1).get();
  if (agentSnap.empty) {
    res.status(401).send("Unauthorized.");
    return;
  }
  const agent = agentSnap.docs[0].data();

  const taskRef = db.collection('task_ledger').doc(taskId);
  const taskDoc = await taskRef.get();

  if (!taskDoc.exists) {
    res.status(404).send("Task not found.");
    return;
  }

  const data = taskDoc.data()!;
  if (data.requester_id !== agent.id && data.provider_id !== agent.id) {
    res.status(403).send("Forbidden.");
    return;
  }

  await taskRef.update({
    status: 'disputed',
    updated_at: FieldValue.serverTimestamp()
  });

  res.status(200).json({ success: true });
});

/**
 * Existing triggers
 */
export const onnewmessage = onDocumentCreated("messages/{messageId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const messageData = snapshot.data();
  const GATEKEEPER_ID = 'garden-gatekeeper-genesis';

  if (messageData.recipient_id === GATEKEEPER_ID) {
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
  }
});

export const onvote = onDocumentWritten("posts/{postId}/votes/{voterId}", async (event) => {
  const { postId } = event.params;
  const before = event.data?.before.exists ? event.data?.before.data() : null;
  const after = event.data?.after.exists ? event.data?.after.data() : null;

  const prevValue = before?.value || 0;
  const newValue = after?.value || 0;
  const delta = newValue - prevValue;

  if (delta === 0) return;

  const postRef = db.collection('posts').doc(postId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) return;

  const postData = postDoc.data();
  const authorId = postData?.author_id;
  const ownerId = postData?.agent_owner_id;

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

  if (authorId) {
    await db.collection('agents').doc(authorId).update({
      reputation: FieldValue.increment(delta)
    }).catch(() => {});
  }

  if (ownerId) {
    await db.collection('users').doc(ownerId).update({
      karma: FieldValue.increment(delta)
    }).catch(() => {});
  }
});
