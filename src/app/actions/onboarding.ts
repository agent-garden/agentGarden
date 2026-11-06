'use server';

import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { requireUser, isAdminUid, generateApiKey, safeEqual } from '@/lib/server-auth';
import { auditAgentSecurity } from '@/ai/flows/audit-agent-security';

/**
 * @fileOverview Invite-gated onboarding for gardeners (humans) and residents (agents).
 * All writes happen here with the Admin SDK so invite codes, profiles and
 * agent credentials cannot be forged from the browser.
 */

const MONTHLY_INVITES = 30;

function masterCodeMatches(code: string) {
  const master = process.env.MASTER_INVITE_CODE;
  return !!master && safeEqual(code, master);
}

function isBootstrapAdmin(decoded: { email?: string; email_verified?: boolean }) {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!decoded.email && decoded.email_verified === true && list.includes(decoded.email.toLowerCase());
}

async function grantAdmin(uid: string) {
  const { db, auth } = initializeAdmin();
  const user = await auth.getUser(uid);
  if (user.customClaims?.admin !== true) {
    await auth.setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
  }
  await Promise.all([
    db.collection('users').doc(uid).set({ isAdmin: true }, { merge: true }),
    db.collection('roles_admin').doc(uid).set({ role: 'admin', granted_by: 'ADMIN_EMAILS', granted_at: FieldValue.serverTimestamp() }, { merge: true }),
  ]);
}

/**
 * Called after any sign-in. Reports whether the caller has a gardener profile.
 * Verified emails listed in the server-only ADMIN_EMAILS setting get a profile
 * and admin rights automatically (no invite needed).
 */
export async function getProfileStatus(idToken: string) {
  const decoded = await requireUser(idToken);
  const { db } = initializeAdmin();
  const userRef = db.collection('users').doc(decoded.uid);
  const profile = await userRef.get();

  if (isBootstrapAdmin(decoded)) {
    if (!profile.exists) {
      const email = decoded.email || '';
      await userRef.set({
        id: decoded.uid,
        email,
        displayName: decoded.name || email.split('@')[0] || 'Gardener',
        monthly_invite_limit: MONTHLY_INVITES,
        invites_remaining: MONTHLY_INVITES,
        karma: 0,
        created_at: Date.now(),
        invite_code_used: 'ADMIN_EMAILS',
      });
    }
    await grantAdmin(decoded.uid);
    return { hasProfile: true, isAdmin: true };
  }

  if (!profile.exists) return { hasProfile: false, isAdmin: false };
  return { hasProfile: true, isAdmin: await isAdminUid(decoded.uid, decoded) };
}

/** Lightweight pre-check used before creating an Auth account. */
export async function checkInviteCode(code: string) {
  const clean = String(code || '').trim();
  if (!clean || clean.length > 64) return { valid: false };
  if (masterCodeMatches(clean)) return { valid: true };
  const snap = await initializeAdmin().db.collection('invite_codes').doc(clean).get();
  return { valid: snap.exists && (snap.data()?.uses_left ?? 0) > 0 };
}

/**
 * Creates the caller's gardener profile and burns their invite code.
 * For brand-new email/password accounts, an invalid code removes the fresh
 * Auth account so it cannot linger un-invited. Google sign-ins keep their
 * account and can retry with another code.
 */
export async function completeSignup(idToken: string, inviteCode: string, removeAccountOnFailure = true) {
  const decoded = await requireUser(idToken);
  const { db, auth } = initializeAdmin();
  const userRef = db.collection('users').doc(decoded.uid);
  const code = String(inviteCode || '').trim();

  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(userRef);
      if (existing.exists) return;

      if (!masterCodeMatches(code)) {
        if (!code) throw new Error('Invite code is required for registration.');
        const inviteRef = db.collection('invite_codes').doc(code);
        const invite = await tx.get(inviteRef);
        if (!invite.exists) throw new Error('Invalid invite code.');
        if ((invite.data()!.uses_left ?? 0) <= 0) throw new Error('This invite code has no uses left.');
        tx.update(inviteRef, {
          uses_left: FieldValue.increment(-1),
          last_used_at: Date.now(),
          last_used_by: decoded.uid,
        });
      }

      const email = decoded.email || '';
      tx.set(userRef, {
        id: decoded.uid,
        email,
        displayName: decoded.name || email.split('@')[0] || 'Gardener',
        monthly_invite_limit: MONTHLY_INVITES,
        invites_remaining: MONTHLY_INVITES,
        karma: 0,
        created_at: Date.now(),
        invite_code_used: masterCodeMatches(code) ? 'MASTER' : code,
      });
    });
    return { success: true };
  } catch (error: any) {
    const profile = await userRef.get();
    if (!profile.exists && removeAccountOnFailure) {
      await auth.deleteUser(decoded.uid).catch(() => {});
    }
    throw new Error(error.message || 'Could not complete registration.');
  }
}

const RegisterAgentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  handle: z.string().trim().regex(/^@[a-zA-Z0-9_]{2,32}$/, 'Handle must look like @name (letters, numbers, underscores).'),
  category: z.string().trim().max(40),
  introduction: z.string().trim().min(10).max(500),
  system_instruction: z.string().trim().min(20).max(8000),
  specialties: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  stack: z.string().trim().min(1).max(80),
  location: z.string().trim().max(80).default('Cloud'),
  timezone: z.string().trim().max(64).default('UTC'),
  public_key: z.string().trim().max(2000),
  signing_public_key: z.string().trim().max(2000),
  endpoint_url: z.string().trim().url().max(500).optional().or(z.literal('')),
  payment_address: z.string().trim().max(200).optional().or(z.literal('')),
  base_fee_cents: z.number().int().min(0).max(10_000_000).default(0),
  invite_code: z.string().trim().max(64).optional().or(z.literal('')),
});
export type RegisterAgentInput = z.input<typeof RegisterAgentSchema>;

/**
 * Publishes a resident agent. Runs the DNA security audit server-side,
 * issues a machine API key (returned once, stored only as a hash) and writes
 * `search_text` so the Vector Search extension embeds the agent.
 */
export async function registerAgent(idToken: string, rawInput: RegisterAgentInput) {
  const decoded = await requireUser(idToken);
  const parsed = RegisterAgentSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '));
  }
  const input = parsed.data;
  const { db } = initializeAdmin();

  const profile = await db.collection('users').doc(decoded.uid).get();
  if (!profile.exists) throw new Error('Finish signing up before publishing an agent.');
  const admin = await isAdminUid(decoded.uid, decoded);

  const dupe = await db.collection('agents').where('handle', '==', input.handle).limit(1).get();
  if (!dupe.empty) throw new Error(`The handle ${input.handle} is already taken.`);

  let audit: { status: 'trusted' | 'unverified' | 'scanned'; risk_level: string; findings: string[] } = {
    status: 'unverified',
    risk_level: 'unknown',
    findings: ['Security audit unavailable; agent will be re-audited.'],
  };
  try {
    const result = await auditAgentSecurity({ name: input.name, system_instruction: input.system_instruction });
    audit = { status: result.status, risk_level: result.risk_level, findings: result.findings };
  } catch (error) {
    console.warn('Security audit failed:', error);
  }

  const agentRef = db.collection('agents').doc();
  const { apiKey, hash } = generateApiKey();
  const code = input.invite_code || '';

  await db.runTransaction(async (tx) => {
    if (!admin) {
      if (!code) throw new Error('An invite code is required to publish an agent.');
      if (!masterCodeMatches(code)) {
        const inviteRef = db.collection('invite_codes').doc(code);
        const invite = await tx.get(inviteRef);
        if (!invite.exists || (invite.data()!.uses_left ?? 0) <= 0) throw new Error('Invalid or exhausted invite code.');
        tx.update(inviteRef, { uses_left: FieldValue.increment(-1), last_used_at: Date.now(), last_used_by: decoded.uid });
      }
    }

    tx.set(agentRef, {
      id: agentRef.id,
      owner_id: decoded.uid,
      name: input.name,
      handle: input.handle,
      category: input.category,
      introduction: input.introduction,
      system_instruction: input.system_instruction,
      specialties: input.specialties,
      stack: input.stack,
      location: input.location,
      timezone: input.timezone,
      public_key: input.public_key,
      signing_public_key: input.signing_public_key,
      endpoint_url: input.endpoint_url || null,
      supports_x402: !!input.payment_address,
      payment_address: input.payment_address || null,
      base_fee_cents: input.base_fee_cents,
      search_text: `${input.name} ${input.handle}. ${input.introduction} ${input.system_instruction} Skills: ${input.specialties.join(', ')}.`,
      status: 'active',
      availability: 'Active',
      verified: false,
      is_machine_verified: false,
      trust_level: 1,
      review_count: 0,
      reputation: 0,
      verified_task_count: 0,
      security_status: audit.status,
      security_risk_level: audit.risk_level,
      security_findings: audit.findings,
      last_heartbeat: null,
      created_at: Date.now(),
    });
    tx.set(db.collection('agent_keys').doc(hash), {
      agent_id: agentRef.id,
      owner_id: decoded.uid,
      created_at: Date.now(),
    });
    tx.set(db.collection('users').doc(decoded.uid), { signing_public_key: input.signing_public_key }, { merge: true });
  });

  return { success: true, agentId: agentRef.id, apiKey, auditStatus: audit.status };
}

/** Issues a fresh API key for one of the caller's agents and revokes the old ones. */
export async function rotateAgentApiKey(idToken: string, agentId: string) {
  const { uid } = await requireUser(idToken);
  const { db } = initializeAdmin();
  const agent = await db.collection('agents').doc(agentId).get();
  if (!agent.exists || agent.data()?.owner_id !== uid) throw new Error('You can only rotate keys for your own agents.');

  const old = await db.collection('agent_keys').where('agent_id', '==', agentId).get();
  const { apiKey, hash } = generateApiKey();
  const batch = db.batch();
  old.forEach((d) => batch.delete(d.ref));
  batch.set(db.collection('agent_keys').doc(hash), { agent_id: agentId, owner_id: uid, created_at: Date.now() });
  await batch.commit();
  return { apiKey };
}
