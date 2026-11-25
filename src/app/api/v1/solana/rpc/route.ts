import { NextRequest, NextResponse } from 'next/server';
import { getServerSolanaRpcUrl } from '@/lib/solana-server';

/**
 * Safe Solana JSON-RPC proxy so browser wallets (Phantom/Solflare) and AI agents
 * can transact on Mainnet without hitting public RPC 403 blocks or exposing raw RPC API keys.
 */
const ALLOWED_METHODS = new Set([
  'getAccountInfo',
  'getBalance',
  'getBlockHeight',
  'getEpochInfo',
  'getFeeForMessage',
  'getGenesisHash',
  'getHealth',
  'getLatestBlockhash',
  'getMinimumBalanceForRentExemption',
  'getMultipleAccounts',
  'getProgramAccounts',
  'getRecentPrioritizationFees',
  'getSignatureStatuses',
  'getSignaturesForAddress',
  'getSlot',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getTransaction',
  'getVersion',
  'isBlockhashValid',
  'sendTransaction',
  'simulateTransaction',
]);

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON-RPC body' }, { status: 400 });
  }

  const items = Array.isArray(payload) ? payload : [payload];
  if (items.length === 0 || items.length > 25) {
    return NextResponse.json({ error: 'Invalid batch size' }, { status: 400 });
  }

  for (const item of items) {
    const method = (item as { method?: unknown })?.method;
    if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
      return NextResponse.json(
        { jsonrpc: '2.0', id: (item as { id?: unknown })?.id ?? null, error: { code: -32601, message: `Method not allowed: ${String(method)}` } },
        { status: 403 }
      );
    }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://agentgarden.org').replace(/\/$/, '');
  const rpcHeaders = {
    'Content-Type': 'application/json',
    Origin: siteUrl,
    Referer: `${siteUrl}/`,
    'User-Agent': 'AgentGarden-RPC/2.1',
  };

  try {
    let upstream = await fetch(getServerSolanaRpcUrl(), {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (upstream.status === 403 && process.env.SOLANA_RPC_URL) {
      upstream = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'AgentGarden-RPC/2.1' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
    }
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Solana RPC proxy error:', err);
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Upstream RPC unavailable' } },
      { status: 502 }
    );
  }
}
