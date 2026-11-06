'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { requireAdmin, generateInviteCode } from '@/lib/server-auth';
import { GENESIS_AGENTS } from '@/lib/genesis-agents';

/**
 * @fileOverview Master Gardener actions. Every call requires a verified
 * Firebase ID token belonging to an admin.
 */

export async function batchGenerateInviteCodes(idToken: string, count = 10) {
  const { uid } = await requireAdmin(idToken);
  const { db } = initializeAdmin();
  const batch = db.batch();
  const codes: string[] = [];
  for (let i = 0; i < Math.min(Math.max(count, 1), 50); i++) {
    const code = generateInviteCode();
    batch.set(db.collection('invite_codes').doc(code), {
      id: code,
      uses_left: 1,
      assigned_to: 'Unassigned',
      created_by: uid,
      created_at: Date.now(),
      status: 'active',
    });
    codes.push(code);
  }
  await batch.commit();
  return { success: true, codes, message: `${codes.length} invite codes generated.` };
}

export async function approveInviteRequests(idToken: string, requestIds: string[]) {
  const { uid } = await requireAdmin(idToken);
  const { db } = initializeAdmin();
  const results: { email: string; code: string }[] = [];
  const batch = db.batch();
  for (const id of requestIds.slice(0, 100)) {
    const requestRef = db.collection('invite_requests').doc(id);
    const req = await requestRef.get();
    if (!req.exists || req.data()?.status === 'approved') continue;
    const email = req.data()!.email as string;
    const code = generateInviteCode();
    batch.set(db.collection('invite_codes').doc(code), {
      id: code,
      uses_left: 1,
      assigned_to: email,
      created_by: uid,
      created_at: Date.now(),
      status: 'active',
    });
    batch.update(requestRef, { status: 'approved', generated_code: code, approved_at: Date.now(), approved_by: uid });
    results.push({ email, code });
  }
  await batch.commit();
  return { success: true, results };
}

export async function updateMonthlyLimit(idToken: string, userId: string, limit: number) {
  await requireAdmin(idToken);
  const safeLimit = Math.max(0, Math.min(1000, Math.floor(limit)));
  await initializeAdmin().db.collection('users').doc(userId).update({ monthly_invite_limit: safeLimit });
  return { success: true, message: 'User limit updated.' };
}

/** Refills every gardener's invite balance up to their monthly limit. */
export async function resetAllUserInvites(idToken: string) {
  await requireAdmin(idToken);
  const { db } = initializeAdmin();
  const users = await db.collection('users').get();
  const writer = db.bulkWriter();
  users.forEach((u) => {
    writer.update(u.ref, { invites_remaining: u.data().monthly_invite_limit ?? 30 });
  });
  await writer.close();
  return { success: true, count: users.size };
}

export async function seedGenesisAgents(idToken: string) {
  await requireAdmin(idToken);
  const { db } = initializeAdmin();
  const batch = db.batch();
  for (const agent of GENESIS_AGENTS) {
    batch.set(db.collection('agents').doc(agent.id), { ...agent, created_at: Date.now() }, { merge: true });
  }
  await batch.commit();
  return { success: true, count: GENESIS_AGENTS.length };
}

/** Grants or revokes admin rights (custom claim + roles_admin registry). */
export async function setAdminRole(idToken: string, targetUid: string, makeAdmin: boolean) {
  const { uid } = await requireAdmin(idToken);
  if (targetUid === uid && !makeAdmin) throw new Error('You cannot remove your own admin rights.');
  const { db, auth } = initializeAdmin();
  const user = await auth.getUser(targetUid);
  await auth.setCustomUserClaims(targetUid, { ...(user.customClaims || {}), admin: makeAdmin });
  const roleRef = db.collection('roles_admin').doc(targetUid);
  if (makeAdmin) {
    await roleRef.set({ role: 'admin', granted_by: uid, granted_at: FieldValue.serverTimestamp() });
  } else {
    await roleRef.delete();
  }
  return { success: true };
}

/** Lets the admin page ask the server whether the caller is an admin. */
export async function checkAdmin(idToken: string) {
  try {
    await requireAdmin(idToken);
    return { isAdmin: true };
  } catch {
    return { isAdmin: false };
  }
}
