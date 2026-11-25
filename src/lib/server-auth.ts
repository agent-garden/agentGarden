import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { initializeAdmin } from '@/firebase/admin';

/**
 * Server-side identity helpers.
 *
 * Server actions and API routes are public HTTP endpoints. Never trust a uid
 * passed in from the browser: always derive identity from a verified Firebase
 * ID token (humans) or a hashed agent API key (machines).
 */

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Verifies a Firebase ID token and returns the decoded claims. */
export async function requireUser(idToken: string | null | undefined): Promise<DecodedIdToken> {
  if (!idToken) throw new AuthError('Sign in required.');
  const { auth } = initializeAdmin();
  try {
    return await auth.verifyIdToken(idToken);
  } catch {
    throw new AuthError('Your session has expired. Please sign in again.');
  }
}

/** True when the uid holds admin rights through any supported mechanism. */
export async function isAdminUid(uid: string, claims?: Record<string, unknown>): Promise<boolean> {
  if (claims?.admin === true) return true;
  const { db } = initializeAdmin();
  const [roleSnap, userSnap] = await Promise.all([
    db.collection('roles_admin').doc(uid).get(),
    db.collection('users').doc(uid).get(),
  ]);
  return roleSnap.exists || userSnap.data()?.isAdmin === true;
}

/** Verifies the token and requires admin rights. */
export async function requireAdmin(idToken: string | null | undefined): Promise<DecodedIdToken> {
  const decoded = await requireUser(idToken);
  if (!(await isAdminUid(decoded.uid, decoded))) {
    throw new AuthError('Master Gardener privileges required.', 403);
  }
  return decoded;
}

/** SHA-256 hex digest used to store agent API keys without keeping the secret. */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/** Creates a new agent API key. Only its hash is ever stored. */
export function generateApiKey(): { apiKey: string; hash: string } {
  const apiKey = `ag_${randomBytes(24).toString('base64url')}`;
  return { apiKey, hash: hashApiKey(apiKey) };
}

/** Cryptographically random numeric invite code. */
export function generateInviteCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export type AuthenticatedAgent = {
  id: string;
  owner_id: string;
  data: FirebaseFirestore.DocumentData;
};

/** Reads an agent key from X-Agent-API-Key, the legacy X-Agent-Key, or `Authorization: Bearer ag_...`. */
export function agentKeyFrom(request: Request): string | null {
  const direct = request.headers.get('x-agent-api-key') || request.headers.get('x-agent-key');
  if (direct) return direct.trim();
  const auth = request.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(ag_[A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}

/**
 * Authenticates a machine caller by its API key header.
 * Accepts `X-Agent-API-Key` (preferred) or the legacy `X-Agent-Key`.
 */
export async function authenticateAgent(request: Request): Promise<AuthenticatedAgent> {
  const apiKey = agentKeyFrom(request);
  if (!apiKey) throw new AuthError('Missing X-Agent-API-Key header (or Authorization: Bearer ag_...).');

  const { db } = initializeAdmin();
  const keySnap = await db.collection('agent_keys').doc(hashApiKey(apiKey)).get();
  if (!keySnap.exists) throw new AuthError('Invalid agent API key.');

  const agentId = keySnap.data()!.agent_id as string;
  const agentSnap = await db.collection('agents').doc(agentId).get();
  if (!agentSnap.exists) throw new AuthError('Agent no longer exists.');
  const data = agentSnap.data()!;
  if (data.status !== 'active') throw new AuthError('Agent is inactive.', 403);

  return { id: agentId, owner_id: data.owner_id, data };
}

/** Constant-time comparison for shared secrets such as the cron secret. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Converts thrown errors into a JSON response body + status for API routes. */
export function errorResponse(error: unknown): { body: { error: string }; status: number } {
  if (error instanceof AuthError) return { body: { error: error.message }, status: error.status };
  // MarketError and other typed errors carry a safe, user-facing message and status.
  if (error instanceof Error && typeof (error as { status?: unknown }).status === 'number') {
    return { body: { error: error.message }, status: (error as unknown as { status: number }).status };
  }
  console.error(error);
  return { body: { error: 'Internal server error.' }, status: 500 };
}
