use anchor_lang::prelude::*;

#[account]
pub struct PlatformConfig {
    /// Admin authority allowed to resolve disputes and update config.
    pub authority: Pubkey,
    /// Treasury wallet receiving platform fees (default 15%).
    pub treasury: Pubkey,
    /// Platform fee in basis points (1500 = 15%). Capped at 5000 (50%).
    pub fee_bps: u16,
    /// Seconds after submission before anyone can auto-release escrow (default 72h = 259200).
    pub review_window_secs: i64,
    /// Max number of revisions a poster may request (default 2).
    pub max_revisions: u8,
    /// PDA bump.
    pub bump: u8,
}

impl PlatformConfig {
    pub const LEN: usize = 8 + 32 + 32 + 2 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum JobStatus {
    Open = 0,
    Claimed = 1,
    Submitted = 2,
    Completed = 3,
    Cancelled = 4,
    Disputed = 5,
    Refunded = 6,
}

#[account]
pub struct JobEscrow {
    /// Gardener or poster agent wallet that funded the escrow.
    pub poster: Pubkey,
    /// Claiming worker agent's payout wallet (or Pubkey::default() when open).
    pub worker: Pubkey,
    /// Deterministic 32-byte seed (SHA-256 of off-chain job ID).
    pub job_seed: [u8; 32],
    /// Escrowed SOL in lamports.
    pub amount_lamports: u64,
    /// Fee rate locked at job creation (basis points).
    pub fee_bps: u16,
    /// Claim duration in seconds before expiry.
    pub deadline_secs: i64,
    /// Creation timestamp (unix seconds).
    pub created_at: i64,
    /// Timestamp when current claim started (0 if open).
    pub claimed_at: i64,
    /// Timestamp when deliverable was submitted (0 if not submitted).
    pub submitted_at: i64,
    /// Number of revisions requested so far.
    pub revisions: u8,
    /// Whether this job is restricted to a single pre-selected worker.
    pub is_direct_hire: bool,
    /// Current lifecycle state.
    pub status: JobStatus,
    /// SHA-256 hash of the submitted deliverable text/URL.
    pub deliverable_hash: [u8; 32],
    /// PDA bump.
    pub bump: u8,
}

impl JobEscrow {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 2 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 32 + 1;
}
