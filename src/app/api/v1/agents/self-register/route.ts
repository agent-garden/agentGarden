import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { initializeAdmin } from '@/firebase/admin';
import { errorResponse, generateApiKey } from '@/lib/server-auth';
import { auditAgentSecurity } from '@/ai/flows/audit-agent-security';
import { enforceIpRateLimit, takeAiBudget } from '@/lib/search-guard';
import { isValidSolanaAddress } from '@/lib/solana';

const SelfRegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  handle: z
    .string()
    .trim()
    .regex(/^@[a-zA-Z0-9_]{2,32}$/, 'Handle must be @ followed by 2–32 letters, numbers, or underscores.'),
  category: z.string().trim().min(2).max(40).default('General'),
  introduction: z.string().trim().min(10).max(500),
  system_instruction: z.string().trim().min(20).max(8000),
  specialties: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  stack: z.string().trim().min(1).max(80).default('Autonomous Agent'),
  location: z.string().trim().max(60).default('Cloud'),
  timezone: z.string().trim().max(40).default('UTC'),
  public_key: z.string().trim().max(2000).optional().default(''),
  signing_public_key: z.string().trim().max(2000).optional().default(''),
  solana_address: z.string().trim().max(64).optional().default(''),
  endpoint_url: z.string().trim().url().max(300).optional().or(z.literal('')).default(''),
  base_fee_lamports: z.number().int().min(0).max(1_000_000_000_000).optional().default(0),
});

function generateClaimCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `AG-${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * POST /api/v1/agents/self-register
 * Allows an AI agent to self-register and receive a short claim code (#11).
 * The agent stays pending until a signed-in human gardener redeems the claim code
 * on /dashboard?claim=AG-XXXX-XXXX.
 */
export async function POST(req: NextRequest) {
  try {
    await enforceIpRateLimit('self-register', 5);
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Send a JSON agent manifest.' }, { status: 400 });
    }

    const parsed = SelfRegisterSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
        { status: 400 }
      );
    }
    const input = parsed.data;

    if (input.solana_address && !isValidSolanaAddress(input.solana_address)) {
      return NextResponse.json({ error: 'solana_address must be a valid base58 Solana public key.' }, { status: 400 });
    }

    const { db } = initializeAdmin();
    const existingHandle = await db.collection('agents').where('handle', '==', input.handle).limit(1).get();
    if (!existingHandle.empty) {
      return NextResponse.json({ error: `Handle ${input.handle} is already taken.` }, { status: 409 });
    }

    // Run automated Gatekeeper security scan before issuing a claim code.
    let audit: { status: 'trusted' | 'scanned' | 'unverified'; risk_level: string; findings: string[] } = {
      status: 'unverified',
      risk_level: 'unknown',
      findings: [],
    };
    try {
      if (await takeAiBudget('audit')) {
        const scan = await auditAgentSecurity({
          name: input.name,
          system_instruction: input.system_instruction,
        });
        if (scan.risk_level === 'high') {
          return NextResponse.json(
            { error: `Security audit rejected manifest: ${scan.findings.join('; ') || 'high risk instructions'}` },
            { status: 403 }
          );
        }
        audit = {
          status: scan.status,
          risk_level: scan.risk_level,
          findings: scan.findings,
        };
      }
    } catch (e) {
      console.warn('Self-register audit fallback:', e);
    }

    const { apiKey, hash } = generateApiKey();
    const claimCode = generateClaimCode();
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://agentgarden.org').replace(/\/$/, '');

    await db.collection('pending_agent_claims').doc(claimCode).set({
      claim_code: claimCode,
      key_hash: hash,
      manifest: input,
      audit,
      status: 'pending',
      created_at: now,
      expires_at: expiresAt,
    });

    return NextResponse.json({
      claim_code: claimCode,
      claim_url: `${siteUrl}/dashboard?claim=${encodeURIComponent(claimCode)}`,
      api_key: apiKey,
      expires_at: expiresAt,
      audit_status: audit.status,
      instructions:
        'Give the claim_code (or claim_url) to your human gardener to verify ownership on Agent Garden. Save api_key now — it is shown once and activates immediately upon claim.',
    });
  } catch (err: any) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
