import 'server-only';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  buildAcceptAndReleaseInstruction,
  buildCancelJobInstruction,
  buildClaimJobInstruction,
  buildDisputeJobInstruction,
  buildInitializeJobInstruction,
  buildReleaseClaimInstruction,
  buildRequestRevisionInstruction,
  buildSubmitWorkInstruction,
  decodeJobEscrowAccount,
  deriveJobEscrowPda,
  getEscrowProgramId,
  getSolanaCluster,
  getSolanaRpcUrl,
  getSolanaWsUrl,
  getTreasuryAddress,
  isSmartContractConfigured,
  isValidSolanaAddress,
  jobIdToSeed,
} from '@/lib/solana';

/**
 * @fileOverview Server-only Solana RPC client, transaction builder, and
 * on-chain escrow / deposit verifier.
 */

let cachedConnection: Connection | null = null;

export function getServerSolanaRpcUrl(): string {
  return process.env.SOLANA_RPC_URL || getSolanaRpcUrl();
}

export function getSolanaConnection(): Connection {
  if (!cachedConnection) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://agentgarden.org').replace(/\/$/, '');
    const wsEndpoint = getSolanaWsUrl();
    cachedConnection = new Connection(getServerSolanaRpcUrl(), {
      commitment: 'confirmed',
      ...(wsEndpoint ? { wsEndpoint } : {}),
      httpHeaders: {
        Origin: siteUrl,
        Referer: `${siteUrl}/`,
        'User-Agent': 'AgentGarden-Server/2.1',
      },
    });
  }
  return cachedConnection;
}

export async function getSolBalanceLamports(address: string): Promise<number> {
  if (!isValidSolanaAddress(address)) return 0;
  try {
    const conn = getSolanaConnection();
    return await conn.getBalance(new PublicKey(address));
  } catch (err) {
    console.warn('Failed to fetch SOL balance:', err);
    return 0;
  }
}

export async function fetchOnChainJobEscrow(posterAddress: string, jobId: string) {
  if (!isValidSolanaAddress(posterAddress)) return null;
  const conn = getSolanaConnection();
  const programId = getEscrowProgramId();
  const jobSeed = await jobIdToSeed(jobId);
  const [escrowPda] = deriveJobEscrowPda(new PublicKey(posterAddress), jobSeed, programId);
  const info = await conn.getAccountInfo(escrowPda);
  if (!info || !info.owner.equals(programId)) return null;
  return {
    escrow_pda: escrowPda.toBase58(),
    lamports: info.lamports,
    state: decodeJobEscrowAccount(info.data),
  };
}

export async function verifySolDepositTransaction(opts: {
  signature: string;
  expectedRecipient: string;
  minLamports?: number;
}) {
  const sig = opts.signature.trim();
  if (!sig || sig.length < 32) {
    throw new Error('Invalid Solana transaction signature.');
  }
  if (!isValidSolanaAddress(opts.expectedRecipient)) {
    throw new Error('Platform Solana treasury address is not configured.');
  }

  const conn = getSolanaConnection();
  const tx = await conn.getTransaction(sig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Transaction not found on Solana yet. Wait a few seconds for confirmation and retry.');
  }
  if (tx.meta?.err) {
    throw new Error(`Solana transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`);
  }

  const keys = tx.transaction.message.getAccountKeys().staticAccountKeys.map((k) => k.toBase58());
  const recipientIdx = keys.indexOf(opts.expectedRecipient);
  if (recipientIdx === -1) {
    throw new Error(`Transaction did not involve treasury address ${opts.expectedRecipient}.`);
  }

  const pre = tx.meta?.preBalances[recipientIdx] ?? 0;
  const post = tx.meta?.postBalances[recipientIdx] ?? 0;
  const receivedLamports = post - pre;

  if (receivedLamports <= 0) {
    throw new Error('No net SOL transfer to the treasury was detected in this transaction.');
  }
  if (opts.minLamports && receivedLamports < opts.minLamports) {
    throw new Error(`Received ${receivedLamports} lamports, expected at least ${opts.minLamports}.`);
  }

  const sender = keys[0] || null;
  return {
    verified: true,
    signature: sig,
    sender,
    recipient: opts.expectedRecipient,
    received_lamports: receivedLamports,
    slot: tx.slot,
    block_time: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
  };
}

export async function verifyEscrowTxOnChain(opts: {
  signature: string;
  expectedAccount?: string;
}) {
  const sig = opts.signature.trim();
  if (!sig || sig.length < 32) {
    throw new Error('Invalid Solana transaction signature.');
  }
  const conn = getSolanaConnection();
  const tx = await conn.getTransaction(sig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) {
    throw new Error('Transaction not confirmed on Solana yet. Retry in a few seconds.');
  }
  if (tx.meta?.err) {
    throw new Error(`Smart contract transaction failed: ${JSON.stringify(tx.meta.err)}`);
  }

  const keys = tx.transaction.message.getAccountKeys().staticAccountKeys.map((k) => k.toBase58());
  const programId = getEscrowProgramId().toBase58();
  if (!keys.includes(programId)) {
    throw new Error(`Transaction did not invoke Agent Garden escrow program (${programId}).`);
  }
  if (opts.expectedAccount && !keys.includes(opts.expectedAccount)) {
    throw new Error(`Transaction did not target expected escrow PDA (${opts.expectedAccount}).`);
  }

  return {
    verified: true,
    signature: sig,
    slot: tx.slot,
    block_time: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
    accounts: keys,
  };
}

export type BuildTxAction =
  | 'deposit_treasury'
  | 'initialize_job'
  | 'claim_job'
  | 'release_claim'
  | 'submit_work'
  | 'request_revision'
  | 'accept_and_release'
  | 'cancel_job'
  | 'dispute_job';

export async function buildSerializedSolanaTx(params: {
  action: BuildTxAction;
  feePayer: string;
  jobId?: string;
  poster?: string;
  worker?: string;
  amountLamports?: number;
  deadlineSecs?: number;
  directWorker?: string | null;
  deliverableHashHex?: string;
  posterMustSign?: boolean;
}) {
  if (!isValidSolanaAddress(params.feePayer)) {
    throw new Error('Valid feePayer Solana public key is required.');
  }

  const feePayerPk = new PublicKey(params.feePayer);
  const tx = new Transaction();
  let escrowPda: string | null = null;
  let note = '';

  if (params.action === 'deposit_treasury') {
    const treasury = getTreasuryAddress();
    if (!isValidSolanaAddress(treasury)) {
      throw new Error('Platform treasury Solana address is not configured.');
    }
    const lamports = Math.round(Number(params.amountLamports || 0));
    if (lamports <= 0) throw new Error('amountLamports must be > 0.');
    tx.add(
      SystemProgram.transfer({
        fromPubkey: feePayerPk,
        toPubkey: new PublicKey(treasury),
        lamports,
      })
    );
    note = `Deposit ${lamports} lamports to Agent Garden treasury ${treasury}`;
  } else {
    const jobId = params.jobId || '';
    if (!jobId) throw new Error('jobId is required for escrow smart contract transactions.');
    const posterStr = params.poster || params.feePayer;
    if (!isValidSolanaAddress(posterStr)) throw new Error('Valid poster Solana address is required.');
    const posterPk = new PublicKey(posterStr);

    switch (params.action) {
      case 'initialize_job': {
        const lamports = Math.round(Number(params.amountLamports || 0));
        const deadlineSecs = Math.round(Number(params.deadlineSecs || 24 * 3600));
        const directPk = params.directWorker && isValidSolanaAddress(params.directWorker) ? new PublicKey(params.directWorker) : null;
        const { instruction, jobEscrow } = await buildInitializeJobInstruction({
          poster: posterPk,
          jobId,
          amountLamports: lamports,
          deadlineSecs,
          directWorker: directPk,
        });
        tx.add(instruction);
        escrowPda = jobEscrow.toBase58();
        note = `Initialize escrow PDA ${escrowPda} with ${lamports} lamports`;
        break;
      }
      case 'claim_job': {
        const workerStr = params.worker || params.feePayer;
        if (!isValidSolanaAddress(workerStr)) throw new Error('Valid worker Solana address is required.');
        const { instruction, jobEscrow } = await buildClaimJobInstruction({
          poster: posterPk,
          worker: new PublicKey(workerStr),
          jobId,
        });
        tx.add(instruction);
        escrowPda = jobEscrow.toBase58();
        note = `Claim job escrow ${escrowPda}`;
        break;
      }
      case 'release_claim': {
        const { instruction, jobEscrow } = await buildReleaseClaimInstruction({
          poster: posterPk,
          caller: feePayerPk,
          jobId,
        });
        tx.add(instruction);
        escrowPda = jobEscrow.toBase58();
        note = `Release claim on escrow ${escrowPda}`;
        break;
      }
      case 'submit_work': {
        const workerStr = params.worker || params.feePayer;
        if (!isValidSolanaAddress(workerStr)) throw new Error('Valid worker Solana address is required.');
        if (!params.deliverableHashHex) throw new Error('deliverableHashHex is required.');
        const { instruction, jobEscrow } = await buildSubmitWorkInstruction({
          poster: posterPk,
          worker: new PublicKey(workerStr),
          jobId,
          deliverableHashHex: params.deliverableHashHex,
        });
        tx.add(instruction);
        escrowPda = jobEscrow.toBase58();
        note = `Submit deliverable hash on-chain to ${escrowPda}`;
        break;
      }
      case 'request_revision': {
        const { instruction, jobEscrow } = await buildRequestRevisionInstruction({
          poster: posterPk,
          jobId,
        });
        tx.add(instruction);
        escrowPda = jobEscrow.toBase58();
        note = `Request revision on escrow ${escrowPda}`;
        break;
      }
      case 'accept_and_release': {
        const treasury = getTreasuryAddress();
        if (!isValidSolanaAddress(treasury)) throw new Error('Platform treasury address not configured.');
        const workerStr = params.worker || '';
        if (!isValidSolanaAddress(workerStr)) throw new Error('Valid worker Solana address is required.');
        const { instruction, jobEscrow } = await buildAcceptAndReleaseInstruction({
          poster: posterPk,
          worker: new PublicKey(workerStr),
          treasury: new PublicKey(treasury),
          jobId,
          posterMustSign: params.posterMustSign !== false,
        });
        tx.add(instruction);
        escrowPda = jobEscrow.toBase58();
        note = `Settle escrow ${escrowPda} (85% worker / 15% treasury)`;
        break;
      }
      case 'cancel_job': {
        const { instruction, jobEscrow } = await buildCancelJobInstruction({
          poster: posterPk,
          jobId,
        });
        tx.add(instruction);
        escrowPda = jobEscrow.toBase58();
        note = `Cancel open job escrow ${escrowPda} and refund poster`;
        break;
      }
      case 'dispute_job': {
        const { instruction, jobEscrow } = await buildDisputeJobInstruction({
          poster: posterPk,
          jobId,
        });
        tx.add(instruction);
        escrowPda = jobEscrow.toBase58();
        note = `Flag escrow ${escrowPda} as disputed`;
        break;
      }
    }
  }

  const conn = getSolanaConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = feePayerPk;

  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  return {
    cluster: getSolanaCluster(),
    program_id: getEscrowProgramId().toBase58(),
    smart_contract_configured: isSmartContractConfigured(),
    escrow_pda: escrowPda,
    transaction_base64: Buffer.from(serialized).toString('base64'),
    recent_blockhash: blockhash,
    last_valid_block_height: lastValidBlockHeight,
    note,
  };
}
