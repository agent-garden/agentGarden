import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createHash } from "node:crypto";
import { expect } from "chai";

describe("agent_garden_escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AgentGardenEscrow as Program<any>;
  const authority = provider.wallet as anchor.Wallet;
  const treasury = Keypair.generate();
  const poster = Keypair.generate();
  const worker = Keypair.generate();

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const jobSeed = createHash("sha256").update("test-job-001").digest();
  const [jobEscrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("job"), poster.publicKey.toBuffer(), jobSeed],
    program.programId
  );

  before(async () => {
    for (const kp of [poster, worker, treasury]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 5 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    }
  });

  it("initializes platform config with 15% fee", async () => {
    await program.methods
      .initializePlatform(1500, new anchor.BN(72 * 3600), 2)
      .accounts({
        config: configPda,
        treasury: treasury.publicKey,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg = await program.account.platformConfig.fetch(configPda);
    expect(cfg.feeBps).to.equal(1500);
    expect(cfg.treasury.toBase58()).to.equal(treasury.publicKey.toBase58());
  });

  it("runs full escrow lifecycle: initialize -> claim -> submit -> accept (85/15 split)", async () => {
    const budget = new anchor.BN(1 * LAMPORTS_PER_SOL);
    const deadline = new anchor.BN(24 * 3600);

    await program.methods
      .initializeJob(Array.from(jobSeed), budget, deadline, null)
      .accounts({
        config: configPda,
        jobEscrow: jobEscrowPda,
        poster: poster.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([poster])
      .rpc();

    let escrow = await program.account.jobEscrow.fetch(jobEscrowPda);
    expect(escrow.amountLamports.toNumber()).to.equal(1 * LAMPORTS_PER_SOL);

    await program.methods
      .claimJob()
      .accounts({
        jobEscrow: jobEscrowPda,
        worker: worker.publicKey,
      })
      .signers([worker])
      .rpc();

    const deliverableHash = createHash("sha256").update("deliverable-payload").digest();
    await program.methods
      .submitWork(Array.from(deliverableHash))
      .accounts({
        jobEscrow: jobEscrowPda,
        worker: worker.publicKey,
      })
      .signers([worker])
      .rpc();

    const workerBefore = await provider.connection.getBalance(worker.publicKey);
    const treasuryBefore = await provider.connection.getBalance(treasury.publicKey);

    const acceptIx = await program.methods
      .acceptAndRelease()
      .accounts({
        config: configPda,
        jobEscrow: jobEscrowPda,
        poster: poster.publicKey,
        worker: worker.publicKey,
        treasury: treasury.publicKey,
      })
      .instruction();
    acceptIx.keys[2].isSigner = true;
    await provider.sendAndConfirm(new Transaction().add(acceptIx), [poster]);

    const workerAfter = await provider.connection.getBalance(worker.publicKey);
    const treasuryAfter = await provider.connection.getBalance(treasury.publicKey);

    expect(workerAfter - workerBefore).to.equal(0.85 * LAMPORTS_PER_SOL);
    expect(treasuryAfter - treasuryBefore).to.equal(0.15 * LAMPORTS_PER_SOL);
  });

  it("allows poster to cancel an unclaimed job for full refund", async () => {
    const cancelSeed = createHash("sha256").update("test-job-cancel").digest();
    const [cancelPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("job"), poster.publicKey.toBuffer(), cancelSeed],
      program.programId
    );

    const before = await provider.connection.getBalance(poster.publicKey);
    await program.methods
      .initializeJob(Array.from(cancelSeed), new anchor.BN(0.5 * LAMPORTS_PER_SOL), new anchor.BN(3600), null)
      .accounts({
        config: configPda,
        jobEscrow: cancelPda,
        poster: poster.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([poster])
      .rpc();

    await program.methods
      .cancelJob()
      .accounts({
        jobEscrow: cancelPda,
        poster: poster.publicKey,
      })
      .signers([poster])
      .rpc();

    const after = await provider.connection.getBalance(poster.publicKey);
    expect(before - after).to.be.lessThan(50000); // only tx fees lost
  });
});
