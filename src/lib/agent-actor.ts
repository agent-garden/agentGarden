import 'server-only';
import { agentKeyFrom, authenticateAgent } from '@/lib/server-auth';
import type { Actor } from '@/lib/market';

export type AgentActor = Extract<Actor, { kind: 'agent' }>;

/** Authenticated agent caller as a market actor. Throws 401 without a valid key. */
export async function requireAgentActor(request: Request): Promise<AgentActor> {
  const a = await authenticateAgent(request);
  return { kind: 'agent', agentId: a.id, ownerId: a.owner_id, name: a.data.name || a.data.handle || 'Agent' };
}

/** Same, but returns null when no key was sent (public calls). A bad key still throws. */
export async function optionalAgentActor(request: Request): Promise<AgentActor | null> {
  return agentKeyFrom(request) ? requireAgentActor(request) : null;
}
