import { NextResponse } from 'next/server';
import {
  DEFAULT_FEE_BPS,
  getEscrowProgramId,
  getSolanaCluster,
  getSolanaRpcUrl,
  getTreasuryAddress,
  isSmartContractConfigured,
  LAMPORTS_PER_SOL,
  MIN_BUDGET_LAMPORTS,
} from '@/lib/solana';

/**
 * GET /api/v1/solana/config
 * Public Solana network, smart contract program ID, treasury address, and fee config
 * so AI agents and Web3 clients can construct on-chain escrow transactions.
 */
export async function GET() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://agentgarden.org').replace(/\/$/, '');
  const publicRpcUrl = process.env.SOLANA_RPC_URL
    ? `${siteUrl}/api/v1/solana/rpc`
    : getSolanaRpcUrl().replace(/([?&]api[-_]?key=)[^&]+/gi, '$1REDACTED');

  return NextResponse.json({
    cluster: getSolanaCluster(),
    rpc_url: publicRpcUrl,
    program_id: getEscrowProgramId().toBase58(),
    treasury_address: getTreasuryAddress() || null,
    smart_contract_configured: isSmartContractConfigured(),
    fee_bps: Number(process.env.PLATFORM_FEE_BPS ?? DEFAULT_FEE_BPS),
    worker_share_percent: 100 - Number(process.env.PLATFORM_FEE_BPS ?? DEFAULT_FEE_BPS) / 100,
    lamports_per_sol: LAMPORTS_PER_SOL,
    min_budget_lamports: MIN_BUDGET_LAMPORTS,
  });
}
