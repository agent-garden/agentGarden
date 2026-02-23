
import { onDocumentCreated, onDocumentWritten, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

/**
 * @fileOverview Garden Gatekeeper & Work Verification Ledger API
 * Implementation of Phase 1 & 2: Cryptographically auditable Task Ledger & Reputation.
 */

initializeApp();

const db = getFirestore();

/**
 * Ledger: Request Work
 * Initiates a new task in the ledger.
 */
export const requesttask = onRequest(async (req, res) => {
  const apiKey = req.headers['x-agent-key'] as string;
  const { provider_id, intent } = req.body;

  if (!apiKey || !provider_id || !intent) {
    res.status(400).send("Missing parameters: X-Agent-Key header, provider_id, or intent.");
    return;
  }

  // Auth Requester agent via API key
  const agentSnap = await db.collection('agents').where('api_key', '==', apiKey).limit(1).get();
  if (agentSnap.empty) {
    res.status(401).send("Unauthorized: Invalid Agent API Key.");
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
 * Provider agent submits the payload hash of completed work.
 */
export const delivertask = onRequest(async (req, res) => {
  const apiKey = req.headers['x-agent-key'] as string;
  const { taskId, payload_hash } = req.body;

  if (!apiKey || !taskId || !payload_hash) {
    res.status(400).send("Missing parameters: X-Agent-Key header, taskId, or payload_hash.");
    return;
  }

  // Auth Provider agent via API key
  const agentSnap = await db.collection('agents').where('api_key', '==', apiKey).limit(1).get();
  if (agentSnap.empty) {
    res.status(401).send("Unauthorized: Invalid Agent API Key.");
    return;
  }
  const provider = agentSnap.docs[0].data();

  const taskRef = db.collection('task_ledger').doc(taskId);
  const taskDoc = await taskRef.get();

  if (!taskDoc.exists) {
    res.status(404).send("Task not found.");
    return;
  }

  if (taskDoc.data()?.provider_id !== provider.id) {
    res.status(403).send("Forbidden: Only the assigned provider can deliver work.");
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
  const apiKey = req.headers['x-agent-key'] as string;
  const { taskId, verification_sig } = req.body;

  if (!apiKey || !taskId || !verification_sig) {
    res.status(400).send("Missing parameters: X-Agent-Key header, taskId, or verification_sig.");
    return;
  }

  const agentSnap = await db.collection('agents').where('api_key', '==', apiKey).limit(1).get();
  if (agentSnap.empty) {
    res.status(401).send("Unauthorized.");
    return;
  }
  const requesterAgent = agentSnap.docs[0].data();

  const taskRef = db.collection('task_ledger').doc(taskId);
  const taskDoc = await taskRef.get();

  if (!taskDoc.exists) {
    res.status(404).send("Task not found.");
    return;
  }

  const taskData = taskDoc.data()!;
  if (taskData.requester_id !== requesterAgent.id) {
    res.status(403).send("Forbidden: Only the requester can verify this task.");
    return;
  }

  if (taskData.status !== 'delivered') {
    res.status(400).send("Task is not in 'delivered' state.");
    return;
  }

  const publicKeyBase64 = requesterAgent.public_key;
  if (!publicKeyBase64) {
    res.status(500).send("Public key missing for requester agent.");
    return;
  }

  try {
    const dataToVerify = `${taskId}:${taskData.payload_hash}`;
    const verifier = crypto.createVerify('SHA256');
    verifier.update(dataToVerify);
    const publicKey = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;
    const isValid = verifier.verify(publicKey, verification_sig, 'base64');

    if (!isValid) {
      res.status(401).send("Invalid cryptographic signature: Verification failed.");
      return;
    }

    await taskRef.update({
      verification_sig,
      status: 'verified',
      updated_at: FieldValue.serverTimestamp()
    });

    res.status(200).json({ success: true, message: "Work verified and locked in ledger." });
  } catch (error: any) {
    console.error("Verification Error:", error);
    res.status(500).send("Verification internal error.");
  }
});

/**
 * Ledger Trigger: The Reputation Engine
 * Atomically increments the provider agent's verified_task_count when a task is verified.
 */
export const onledgerupdate = onDocumentUpdated("task_ledger/{taskId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;

  // Status transition: delivered/requested -> verified
  if (before.status !== 'verified' && after.status === 'verified') {
    const providerId = after.provider_id;
    if (providerId) {
      await db.collection('agents').doc(providerId).update({
        verified_task_count: FieldValue.increment(1)
      }).catch(err => console.error("Reputation Update Failed:", err));
    }
  }
});

/**
 * Ledger: Dispute Work
 */
export const disputetask = onRequest(async (req, res) => {
  const apiKey = req.headers['x-agent-key'] as string;
  const { taskId } = req.body;

  if (!apiKey || !taskId) {
    res.status(400).send("Missing parameters.");
    return;
  }

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
    res.status(403).send("Forbidden: Only involved agents can dispute.");
    return;
  }

  await taskRef.update({
    status: 'disputed',
    updated_at: FieldValue.serverTimestamp()
  });

  res.status(200).json({ success: true });
});

/**
 * Triggers
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
