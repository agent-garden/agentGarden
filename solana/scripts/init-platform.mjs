#!/usr/bin/env node
/**
 * Idempotently initializes the global PlatformConfig PDA ([b"config"]) for agent_garden_escrow.
 * Usage:
 *   node scripts/init-platform.mjs [devnet|mainnet-beta|testnet|localnet] [treasury_pubkey] [program_id]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

const cluster = process.argv[2] || process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
const rpcUrl =
  cluster === 'localnet'
    ? 'http://127.0.0.1:8899'
    : process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(cluster);

const keypairPath = process.env.SOLANA_KEYPAIR || path.join(os.homedir(), '.config/solana/id.json');
const secret = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
const authority = Keypair.fromSecretKey(Uint8Array.from(secret));

const treasuryStr =
  process.argv[3] || process.env.NEXT_PUBLIC_SOLANA_TREASURY || authority.publicKey.toBase58();
const treasury = new PublicKey(treasuryStr);

let programIdStr = process.argv[4] || process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID;
if (!programIdStr) {
  const kpFile = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../target/deploy/agent_garden_escrow-keypair.json'
  );
  const progSecret = JSON.parse(fs.readFileSync(kpFile, 'utf8'));
  programIdStr = Keypair.fromSecretKey(Uint8Array.from(progSecret)).publicKey.toBase58();
}
const programId = new PublicKey(programIdStr);

const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId);
const connection = new Connection(rpcUrl, 'confirmed');

const existing = await connection.getAccountInfo(configPda);
if (existing) {
  console.log(`PlatformConfig PDA already initialized: ${configPda.toBase58()}`);
  process.exit(0);
}

// Borsh encode initialize_platform(fee_bps: u16, review_window_secs: i64, max_revisions: u8)
const disc = createHash('sha256').update('global:initialize_platform').digest().subarray(0, 8);
const args = Buffer.alloc(2 + 8 + 1);
args.writeUInt16LE(1500, 0); // 15%
args.writeBigInt64LE(BigInt(72 * 3600), 2); // 72h review window
args.writeUInt8(2, 10); // max 2 revisions
const data = Buffer.concat([disc, args]);

const ix = new TransactionInstruction({
  programId,
  keys: [
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: false },
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data,
});

const tx = new Transaction().add(ix);
const sig = await sendAndConfirmTransaction(connection, tx, [authority], {
  commitment: 'confirmed',
});
console.log(`Initialized PlatformConfig PDA ${configPda.toBase58()} (treasury: ${treasury.toBase58()})`);
console.log(`Signature: ${sig}`);
