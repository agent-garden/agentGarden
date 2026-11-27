// Unit tests for Agent Garden Solana Web3 primitives, PDA derivation,
// Anchor Borsh serialization/deserialization, and Ed25519 signature verification.
// Run: node --test tests/solana.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import {
  buildAcceptAndReleaseInstruction,
  buildCancelJobInstruction,
  buildClaimJobInstruction,
  buildDisputeJobInstruction,
  buildInitializeJobInstruction,
  buildRequestRevisionInstruction,
  buildSubmitWorkInstruction,
  decodeJobEscrowAccount,
  deriveJobEscrowPda,
  derivePlatformConfigPda,
  formatSol,
  generateAgentSolanaWallet,
  isValidSolanaAddress,
  jobIdToSeed,
  LAMPORTS_PER_SOL,
  MIN_BUDGET_LAMPORTS,
  solToLamports,
  splitLamports,
  verifySolanaMessageSignature,
} from '../src/lib/solana.ts';

test('SOL/lamport conversion, formatting, and 85/15 split', () => {
  assert.equal(solToLamports(1), LAMPORTS_PER_SOL);
  assert.equal(solToLamports('0.25'), 250_000_000);
  assert.equal(formatSol(250_000_000), '0.25 SOL');
  assert.equal(formatSol(1_000_000), '0.001 SOL');
  assert.equal(MIN_BUDGET_LAMPORTS, 2_000_000);

  const minSplit = splitLamports(MIN_BUDGET_LAMPORTS, 1500);
  assert.ok(minSplit.payout_lamports > 890_880, '85% of min budget must exceed 0-byte Solana rent-exempt minimum');

  const split = splitLamports(1_000_000_000, 1500);
  assert.equal(split.fee_lamports, 150_000_000);
  assert.equal(split.payout_lamports, 850_000_000);
});

test('Solana address validation and Ed25519 signature verification', () => {
  const wallet = generateAgentSolanaWallet();
  assert.equal(isValidSolanaAddress(wallet.publicKey), true);
  assert.equal(isValidSolanaAddress('11111111111111111111111111111111'), false);
  assert.equal(isValidSolanaAddress('0x1234567890abcdef'), false);
  assert.equal(isValidSolanaAddress('not-a-wallet'), false);

  const secretBytes = bs58.decode(wallet.secretKeyBase58);
  const kp = Keypair.fromSecretKey(secretBytes);
  assert.equal(kp.publicKey.toBase58(), wallet.publicKey);

  const msg = 'Link Solana wallet to Agent Garden account user_123';
  const sigBytes = nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey);
  const sigBase58 = bs58.encode(sigBytes);

  assert.equal(verifySolanaMessageSignature(wallet.publicKey, msg, sigBase58), true);
  assert.equal(verifySolanaMessageSignature(wallet.publicKey, msg + '!', sigBase58), false);

  const other = Keypair.generate();
  assert.equal(verifySolanaMessageSignature(other.publicKey.toBase58(), msg, sigBase58), false);
});

test('Deterministic Anchor PDAs and Borsh instruction encoding', async () => {
  const poster = Keypair.generate().publicKey;
  const worker = Keypair.generate().publicKey;
  const treasury = Keypair.generate().publicKey;
  const jobId = 'job_abc123456';

  const seed = await jobIdToSeed(jobId);
  assert.equal(seed.length, 32);

  const [configPda] = derivePlatformConfigPda();
  const [escrowPda] = deriveJobEscrowPda(poster, seed);
  assert.ok(configPda instanceof PublicKey);
  assert.ok(escrowPda instanceof PublicKey);

  // Check initialize_job instruction layout
  const initRes = await buildInitializeJobInstruction({
    poster,
    jobId,
    amountLamports: 500_000_000,
    deadlineSecs: 24 * 3600,
    directWorker: worker,
  });
  assert.equal(initRes.jobEscrow.toBase58(), escrowPda.toBase58());
  const expectedDisc = createHash('sha256').update('global:initialize_job').digest().subarray(0, 8);
  assert.deepEqual(Buffer.from(initRes.instruction.data.subarray(0, 8)), expectedDisc);
  assert.equal(initRes.instruction.data.length, 8 + 32 + 8 + 8 + 1 + 32);

  const claimRes = await buildClaimJobInstruction({ poster, worker, jobId });
  assert.equal(claimRes.instruction.keys[1].pubkey.toBase58(), worker.toBase58());

  const hashHex = createHash('sha256').update('hello world').digest('hex');
  const submitRes = await buildSubmitWorkInstruction({ poster, worker, jobId, deliverableHashHex: hashHex });
  assert.equal(submitRes.instruction.data.length, 8 + 32);

  const reviseRes = await buildRequestRevisionInstruction({ poster, jobId });
  assert.equal(reviseRes.instruction.keys.length, 3);

  const acceptRes = await buildAcceptAndReleaseInstruction({ poster, worker, treasury, jobId });
  assert.equal(acceptRes.instruction.keys.length, 5);
  assert.equal(acceptRes.instruction.keys[4].pubkey.toBase58(), treasury.toBase58());

  const cancelRes = await buildCancelJobInstruction({ poster, jobId });
  assert.equal(cancelRes.instruction.keys.length, 2);

  const disputeRes = await buildDisputeJobInstruction({ poster, jobId });
  assert.equal(disputeRes.instruction.keys.length, 2);
});

test('Decodes on-chain Anchor JobEscrow 182-byte account layout accurately', async () => {
  const poster = Keypair.generate().publicKey;
  const worker = Keypair.generate().publicKey;
  const seed = await jobIdToSeed('job_decode_test');
  const hash = createHash('sha256').update('deliverable').digest();

  const buf = new Uint8Array(182);
  const view = new DataView(buf.buffer);
  buf.set(poster.toBytes(), 8);
  buf.set(worker.toBytes(), 40);
  buf.set(seed, 72);
  view.setBigUint64(104, BigInt(750_000_000), true);
  view.setUint16(112, 1500, true);
  view.setBigInt64(114, BigInt(86400), true);
  view.setBigInt64(122, BigInt(1700000000), true);
  view.setBigInt64(130, BigInt(1700001000), true);
  view.setBigInt64(138, BigInt(1700002000), true);
  buf[146] = 1; // revisions
  buf[147] = 1; // is_direct_hire
  buf[148] = 2; // JobStatus::Submitted
  buf.set(hash, 149);
  buf[181] = 255;

  const decoded = decodeJobEscrowAccount(buf);
  assert.ok(decoded);
  assert.equal(decoded.poster, poster.toBase58());
  assert.equal(decoded.worker, worker.toBase58());
  assert.equal(decoded.amount_lamports, 750_000_000);
  assert.equal(decoded.fee_bps, 1500);
  assert.equal(decoded.deadline_secs, 86400);
  assert.equal(decoded.revisions, 1);
  assert.equal(decoded.is_direct_hire, true);
  assert.equal(decoded.status, 'submitted');
  assert.equal(decoded.deliverable_hash, hash.toString('hex'));
});
