import {
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

/**
 * @fileOverview Shared Solana Web3 primitives (browser + server safe).
 *
 * Implements Anchor-compatible PDA derivation, Borsh instruction encoding,
 * account state decoding, Ed25519 signature verification, and Solana Pay URLs
 * without requiring heavy Anchor Node polyfills in the browser.
 */

export type SolanaCluster = 'devnet' | 'mainnet-beta' | 'testnet' | 'localnet';

export const SOL_DECIMALS = 9;
export { LAMPORTS_PER_SOL };
export const MIN_BUDGET_LAMPORTS = 1_000_000; // 0.001 SOL
export const MAX_BUDGET_LAMPORTS = 1_000 * LAMPORTS_PER_SOL; // 1,000 SOL
export const MIN_PAYOUT_LAMPORTS = 10_000_000; // 0.01 SOL
export const MIN_TOPUP_LAMPORTS = 10_000_000; // 0.01 SOL
export const MAX_TOPUP_LAMPORTS = 500 * LAMPORTS_PER_SOL; // 500 SOL
export const DEFAULT_FEE_BPS = 1500; // 15%

export const DEFAULT_PROGRAM_ID_STR = 'AGarDN1111111111111111111111111111111111111';

export function getSolanaCluster(): SolanaCluster {
  const raw = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet').toLowerCase();
  if (raw === 'mainnet-beta' || raw === 'mainnet') return 'mainnet-beta';
  if (raw === 'testnet') return 'testnet';
  if (raw === 'localnet' || raw === 'localhost') return 'localnet';
  return 'devnet';
}

export function getSolanaRpcUrl(): string {
  const custom = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (custom) return custom;
  const cluster = getSolanaCluster();
  if (cluster === 'localnet') return 'http://127.0.0.1:8899';
  return clusterApiUrl(cluster);
}

export function getEscrowProgramId(): PublicKey {
  const id = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || DEFAULT_PROGRAM_ID_STR;
  return new PublicKey(id);
}

export function isSmartContractConfigured(): boolean {
  const id = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID;
  const treasury = process.env.NEXT_PUBLIC_SOLANA_TREASURY;
  return Boolean(id && id !== DEFAULT_PROGRAM_ID_STR && treasury && isValidSolanaAddress(treasury));
}

export function getTreasuryAddress(): string {
  return process.env.NEXT_PUBLIC_SOLANA_TREASURY || '';
}

export function isValidSolanaAddress(addr: string): boolean {
  if (!addr || typeof addr !== 'string') return false;
  try {
    const pk = new PublicKey(addr.trim());
    return PublicKey.isOnCurve(pk.toBytes()) || pk.toBase58() === addr.trim();
  } catch {
    return false;
  }
}

export function solToLamports(sol: number | string): number {
  const n = typeof sol === 'string' ? parseFloat(sol) : sol;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function formatSol(lamports: number, maxDecimals = 4): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (!Number.isFinite(sol)) return '0 SOL';
  const fixed = sol.toFixed(maxDecimals);
  const trimmed = fixed.replace(/\.?0+$/, '');
  return `${trimmed || '0'} SOL`;
}

export function splitLamports(lamports: number, feeBps = DEFAULT_FEE_BPS) {
  const fee_lamports = Math.floor((lamports * feeBps) / 10_000);
  return { fee_lamports, payout_lamports: lamports - fee_lamports };
}

export function explorerAddressUrl(address: string, cluster = getSolanaCluster()): string {
  const q = cluster === 'mainnet-beta' ? '' : cluster === 'localnet' ? '?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/address/${encodeURIComponent(address)}${q}`;
}

export function explorerTxUrl(signature: string, cluster = getSolanaCluster()): string {
  const q = cluster === 'mainnet-beta' ? '' : cluster === 'localnet' ? '?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${q}`;
}

export function buildSolanaPayUrl(opts: {
  recipient: string;
  amountSol?: number;
  label?: string;
  message?: string;
  memo?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.amountSol && opts.amountSol > 0) params.set('amount', String(opts.amountSol));
  if (opts.label) params.set('label', opts.label);
  if (opts.message) params.set('message', opts.message);
  if (opts.memo) params.set('memo', opts.memo);
  const qs = params.toString();
  return `solana:${opts.recipient}${qs ? `?${qs}` : ''}`;
}

// ---------------------------------------------------------------------------
// Agent Keypair & Ed25519 Signature Verification
// ---------------------------------------------------------------------------

export function generateAgentSolanaWallet() {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey.toBase58(),
    secretKeyBase58: bs58.encode(kp.secretKey),
    secretKeyArray: Array.from(kp.secretKey),
  };
}

export function verifySolanaMessageSignature(
  publicKeyBase58: string,
  message: string,
  signatureBase58: string
): boolean {
  try {
    const pubkey = new PublicKey(publicKeyBase58).toBytes();
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signatureBase58);
    if (sigBytes.length !== 64) return false;
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubkey);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Anchor PDA & Borsh Instruction Builders (Browser + Server)
// ---------------------------------------------------------------------------

async function sha256Bytes(data: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
  return new Uint8Array(hash);
}

async function anchorDiscriminator(ixName: string): Promise<Uint8Array> {
  const hash = await sha256Bytes(`global:${ixName}`);
  return hash.slice(0, 8);
}

export async function jobIdToSeed(jobId: string): Promise<Uint8Array> {
  return sha256Bytes(jobId);
}

export function derivePlatformConfigPda(programId = getEscrowProgramId()): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode('config')], programId);
}

export function deriveJobEscrowPda(
  poster: PublicKey,
  jobSeed: Uint8Array,
  programId = getEscrowProgramId()
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('job'), poster.toBytes(), jobSeed],
    programId
  );
}

function writeU64LE(buf: Uint8Array, offset: number, val: bigint | number) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setBigUint64(offset, BigInt(val), true);
}

function writeI64LE(buf: Uint8Array, offset: number, val: bigint | number) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setBigInt64(offset, BigInt(val), true);
}

function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '').padStart(64, '0').slice(0, 64);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

export async function buildInitializeJobInstruction(opts: {
  poster: PublicKey;
  jobId: string;
  amountLamports: number;
  deadlineSecs: number;
  directWorker?: PublicKey | null;
  programId?: PublicKey;
}) {
  const programId = opts.programId || getEscrowProgramId();
  const jobSeed = await jobIdToSeed(opts.jobId);
  const [config] = derivePlatformConfigPda(programId);
  const [jobEscrow] = deriveJobEscrowPda(opts.poster, jobSeed, programId);
  const disc = await anchorDiscriminator('initialize_job');

  // Layout: 8 disc + 32 job_seed + 8 u64 amount + 8 i64 deadline + 1 option tag (+ 32 pubkey)
  const hasDirect = !!opts.directWorker;
  const data = new Uint8Array(8 + 32 + 8 + 8 + 1 + (hasDirect ? 32 : 0));
  data.set(disc, 0);
  data.set(jobSeed, 8);
  writeU64LE(data, 40, opts.amountLamports);
  writeI64LE(data, 48, opts.deadlineSecs);
  data[56] = hasDirect ? 1 : 0;
  if (opts.directWorker) data.set(opts.directWorker.toBytes(), 57);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: jobEscrow, isSigner: false, isWritable: true },
      { pubkey: opts.poster, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data as unknown as Buffer,
  });

  return { instruction, jobEscrow, jobSeed, config };
}

export async function buildClaimJobInstruction(opts: {
  poster: PublicKey;
  worker: PublicKey;
  jobId: string;
  programId?: PublicKey;
}) {
  const programId = opts.programId || getEscrowProgramId();
  const jobSeed = await jobIdToSeed(opts.jobId);
  const [jobEscrow] = deriveJobEscrowPda(opts.poster, jobSeed, programId);
  const disc = await anchorDiscriminator('claim_job');

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobEscrow, isSigner: false, isWritable: true },
      { pubkey: opts.worker, isSigner: true, isWritable: false },
    ],
    data: disc as unknown as Buffer,
  });

  return { instruction, jobEscrow };
}

export async function buildReleaseClaimInstruction(opts: {
  poster: PublicKey;
  caller: PublicKey;
  jobId: string;
  programId?: PublicKey;
}) {
  const programId = opts.programId || getEscrowProgramId();
  const jobSeed = await jobIdToSeed(opts.jobId);
  const [jobEscrow] = deriveJobEscrowPda(opts.poster, jobSeed, programId);
  const disc = await anchorDiscriminator('release_claim');

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobEscrow, isSigner: false, isWritable: true },
      { pubkey: opts.caller, isSigner: true, isWritable: false },
    ],
    data: disc as unknown as Buffer,
  });

  return { instruction, jobEscrow };
}

export async function buildSubmitWorkInstruction(opts: {
  poster: PublicKey;
  worker: PublicKey;
  jobId: string;
  deliverableHashHex: string;
  programId?: PublicKey;
}) {
  const programId = opts.programId || getEscrowProgramId();
  const jobSeed = await jobIdToSeed(opts.jobId);
  const [jobEscrow] = deriveJobEscrowPda(opts.poster, jobSeed, programId);
  const disc = await anchorDiscriminator('submit_work');
  const hashBytes = hexToBytes32(opts.deliverableHashHex);

  const data = new Uint8Array(8 + 32);
  data.set(disc, 0);
  data.set(hashBytes, 8);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobEscrow, isSigner: false, isWritable: true },
      { pubkey: opts.worker, isSigner: true, isWritable: false },
    ],
    data: data as unknown as Buffer,
  });

  return { instruction, jobEscrow };
}

export async function buildRequestRevisionInstruction(opts: {
  poster: PublicKey;
  jobId: string;
  programId?: PublicKey;
}) {
  const programId = opts.programId || getEscrowProgramId();
  const jobSeed = await jobIdToSeed(opts.jobId);
  const [config] = derivePlatformConfigPda(programId);
  const [jobEscrow] = deriveJobEscrowPda(opts.poster, jobSeed, programId);
  const disc = await anchorDiscriminator('request_revision');

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: jobEscrow, isSigner: false, isWritable: true },
      { pubkey: opts.poster, isSigner: true, isWritable: false },
    ],
    data: disc as unknown as Buffer,
  });

  return { instruction, jobEscrow };
}

export async function buildAcceptAndReleaseInstruction(opts: {
  poster: PublicKey;
  worker: PublicKey;
  treasury: PublicKey;
  jobId: string;
  posterMustSign?: boolean;
  programId?: PublicKey;
}) {
  const programId = opts.programId || getEscrowProgramId();
  const jobSeed = await jobIdToSeed(opts.jobId);
  const [config] = derivePlatformConfigPda(programId);
  const [jobEscrow] = deriveJobEscrowPda(opts.poster, jobSeed, programId);
  const disc = await anchorDiscriminator('accept_and_release');

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: jobEscrow, isSigner: false, isWritable: true },
      { pubkey: opts.poster, isSigner: opts.posterMustSign !== false, isWritable: true },
      { pubkey: opts.worker, isSigner: false, isWritable: true },
      { pubkey: opts.treasury, isSigner: false, isWritable: true },
    ],
    data: disc as unknown as Buffer,
  });

  return { instruction, jobEscrow };
}

export async function buildCancelJobInstruction(opts: {
  poster: PublicKey;
  jobId: string;
  programId?: PublicKey;
}) {
  const programId = opts.programId || getEscrowProgramId();
  const jobSeed = await jobIdToSeed(opts.jobId);
  const [jobEscrow] = deriveJobEscrowPda(opts.poster, jobSeed, programId);
  const disc = await anchorDiscriminator('cancel_job');

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobEscrow, isSigner: false, isWritable: true },
      { pubkey: opts.poster, isSigner: true, isWritable: true },
    ],
    data: disc as unknown as Buffer,
  });

  return { instruction, jobEscrow };
}

export async function buildDisputeJobInstruction(opts: {
  poster: PublicKey;
  jobId: string;
  programId?: PublicKey;
}) {
  const programId = opts.programId || getEscrowProgramId();
  const jobSeed = await jobIdToSeed(opts.jobId);
  const [jobEscrow] = deriveJobEscrowPda(opts.poster, jobSeed, programId);
  const disc = await anchorDiscriminator('dispute_job');

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: jobEscrow, isSigner: false, isWritable: true },
      { pubkey: opts.poster, isSigner: true, isWritable: false },
    ],
    data: disc as unknown as Buffer,
  });

  return { instruction, jobEscrow };
}

// ---------------------------------------------------------------------------
// On-Chain Account State Decoder (matches Anchor JobEscrow struct)
// ---------------------------------------------------------------------------

const ONCHAIN_STATUS_MAP = [
  'open',
  'claimed',
  'submitted',
  'completed',
  'cancelled',
  'disputed',
  'refunded',
] as const;

export type DecodedJobEscrow = {
  poster: string;
  worker: string;
  amount_lamports: number;
  fee_bps: number;
  deadline_secs: number;
  created_at: number;
  claimed_at: number;
  submitted_at: number;
  revisions: number;
  is_direct_hire: boolean;
  status: (typeof ONCHAIN_STATUS_MAP)[number];
  deliverable_hash: string;
};

export function decodeJobEscrowAccount(raw: Uint8Array): DecodedJobEscrow | null {
  if (!raw || raw.length < 182) return null;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const readPubkey = (off: number) => new PublicKey(raw.slice(off, off + 32)).toBase58();

  const poster = readPubkey(8);
  const worker = readPubkey(40);
  // job_seed at 72..104
  const amount_lamports = Number(view.getBigUint64(104, true));
  const fee_bps = view.getUint16(112, true);
  const deadline_secs = Number(view.getBigInt64(114, true));
  const created_at = Number(view.getBigInt64(122, true));
  const claimed_at = Number(view.getBigInt64(130, true));
  const submitted_at = Number(view.getBigInt64(138, true));
  const revisions = raw[146];
  const is_direct_hire = raw[147] === 1;
  const statusByte = raw[148];
  const status = ONCHAIN_STATUS_MAP[statusByte] || 'open';
  const hashBytes = raw.slice(149, 181);
  const deliverable_hash = Array.from(hashBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    poster,
    worker,
    amount_lamports,
    fee_bps,
    deadline_secs,
    created_at,
    claimed_at,
    submitted_at,
    revisions,
    is_direct_hire,
    status,
    deliverable_hash,
  };
}
