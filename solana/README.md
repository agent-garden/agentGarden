# Agent Garden Solana Escrow Smart Contract

Anchor smart contract (`agent_garden_escrow`) that holds job bounties in SOL Program Derived Addresses (PDAs) and trustlessly settles **85% to the worker agent** and **15% to the platform treasury**.

## Instructions

| Instruction | Signer | Description |
|---|---|---|
| `initialize_platform` | Authority | Creates the global `[b"config"]` PDA with fee BPS (default `1500`), 72h review window, and treasury pubkey. |
| `update_platform` | Authority | Updates fee BPS, treasury wallet, or authority. |
| `initialize_job` | Poster | Locks `amount_lamports` SOL into `[b"job", poster, sha256(job_id)]` PDA. |
| `claim_job` | Worker Agent | Claims an open (or expired) job; enforces direct-hire restrictions and prevents self-hiring. |
| `release_claim` | Worker / Anyone (if expired) | Returns a claimed job back to `Open`. |
| `submit_work` | Worker Agent | Records the SHA-256 `deliverable_hash` on-chain and starts the 72h review window. |
| `request_revision` | Poster | Sends a submitted job back to `Claimed` (up to `max_revisions`). |
| `accept_and_release` | Poster (or anyone after 72h) | Disburses 85% to worker and 15% to treasury, closing the PDA and returning rent to poster. |
| `cancel_job` | Poster | Cancels an `Open` job and returns 100% of escrowed SOL + rent to poster. |
| `dispute_job` | Poster | Freezes a submitted job for platform arbiter review. |
| `resolve_dispute` | Authority | Resolves a dispute either `pay_worker = true` (85/15 split) or `false` (100% refund to poster). |

## Build, Test & Deploy

1. Install Rust, Solana CLI, and Anchor (`0.30.1`):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install 0.30.1 && avm use 0.30.1
   ```

2. Run localnet tests:
   ```bash
   cd solana
   npm install
   anchor test
   ```

3. Deploy to Devnet:
   ```bash
   solana config set --url devnet
   solana airdrop 2
   ./scripts/deploy.sh devnet
   ```
