use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

pub mod errors;
pub mod state;

use errors::EscrowError;
use state::{JobEscrow, JobStatus, PlatformConfig};

declare_id!("EMfkXhVANcoRC2u9Ti2j6W7zkCd7PhtZCNa8eLkAYyXZ");

pub const MIN_BUDGET_LAMPORTS: u64 = 1_000_000; // 0.001 SOL
pub const MIN_DEADLINE_SECS: i64 = 3_600; // 1 hour
pub const MAX_DEADLINE_SECS: i64 = 720 * 3_600; // 30 days
pub const MAX_FEE_BPS: u16 = 5_000; // 50%

#[program]
pub mod agent_garden_escrow {
    use super::*;

    /// Initializes the global platform configuration PDA.
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        fee_bps: u16,
        review_window_secs: i64,
        max_revisions: u8,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, EscrowError::FeeTooHigh);
        require!(review_window_secs >= MIN_DEADLINE_SECS, EscrowError::InvalidReviewWindow);

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_bps = fee_bps;
        config.review_window_secs = review_window_secs;
        config.max_revisions = max_revisions;
        config.bump = ctx.bumps.config;

        emit!(PlatformUpdated {
            authority: config.authority,
            treasury: config.treasury,
            fee_bps: config.fee_bps,
        });

        Ok(())
    }

    /// Updates fee rate, treasury wallet, or platform authority.
    pub fn update_platform(
        ctx: Context<UpdatePlatform>,
        new_fee_bps: Option<u16>,
        new_treasury: Option<Pubkey>,
        new_authority: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        if let Some(fee) = new_fee_bps {
            require!(fee <= MAX_FEE_BPS, EscrowError::FeeTooHigh);
            config.fee_bps = fee;
        }
        if let Some(treasury) = new_treasury {
            config.treasury = treasury;
        }
        if let Some(authority) = new_authority {
            config.authority = authority;
        }

        emit!(PlatformUpdated {
            authority: config.authority,
            treasury: config.treasury,
            fee_bps: config.fee_bps,
        });

        Ok(())
    }

    /// Creates a new job escrow PDA and locks `amount_lamports` SOL inside it.
    pub fn initialize_job(
        ctx: Context<InitializeJob>,
        job_seed: [u8; 32],
        amount_lamports: u64,
        deadline_secs: i64,
        direct_worker: Option<Pubkey>,
    ) -> Result<()> {
        require!(amount_lamports >= MIN_BUDGET_LAMPORTS, EscrowError::BudgetTooLow);
        require!(
            (MIN_DEADLINE_SECS..=MAX_DEADLINE_SECS).contains(&deadline_secs),
            EscrowError::InvalidDeadline
        );

        let now = Clock::get()?.unix_timestamp;
        let config = &ctx.accounts.config;

        // Transfer escrowed SOL from poster to the JobEscrow PDA.
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.poster.to_account_info(),
                to: ctx.accounts.job_escrow.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount_lamports)?;

        let job = &mut ctx.accounts.job_escrow;
        job.poster = ctx.accounts.poster.key();
        job.worker = direct_worker.unwrap_or_default();
        job.is_direct_hire = direct_worker.is_some();
        job.job_seed = job_seed;
        job.amount_lamports = amount_lamports;
        job.fee_bps = config.fee_bps;
        job.deadline_secs = deadline_secs;
        job.created_at = now;
        job.claimed_at = 0;
        job.submitted_at = 0;
        job.revisions = 0;
        job.status = JobStatus::Open;
        job.deliverable_hash = [0u8; 32];
        job.bump = ctx.bumps.job_escrow;

        emit!(JobCreated {
            escrow: job.key(),
            poster: job.poster,
            amount_lamports,
            fee_bps: job.fee_bps,
            job_seed,
        });

        Ok(())
    }

    /// Allows an autonomous worker agent to claim an Open (or expired Claimed) job.
    pub fn claim_job(ctx: Context<ClaimJob>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let job = &mut ctx.accounts.job_escrow;
        let worker_key = ctx.accounts.worker.key();

        require!(worker_key != job.poster, EscrowError::SelfHireNotAllowed);

        let claimable = job.status == JobStatus::Open
            || (job.status == JobStatus::Claimed && now > job.claimed_at + job.deadline_secs);
        require!(claimable, EscrowError::InvalidStatus);

        if job.is_direct_hire {
            require!(worker_key == job.worker, EscrowError::DirectHireMismatch);
        }

        job.worker = worker_key;
        job.claimed_at = now;
        job.status = JobStatus::Claimed;

        emit!(JobClaimed {
            escrow: job.key(),
            worker: worker_key,
            claimed_at: now,
        });

        Ok(())
    }

    /// Releases a claimed job back to Open (by the worker voluntarily, or by anyone after expiry).
    pub fn release_claim(ctx: Context<ReleaseClaim>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let job = &mut ctx.accounts.job_escrow;
        require!(job.status == JobStatus::Claimed, EscrowError::InvalidStatus);

        let is_worker = ctx.accounts.caller.key() == job.worker;
        let expired = now > job.claimed_at + job.deadline_secs;
        require!(is_worker || expired, EscrowError::ClaimNotExpired);

        job.status = JobStatus::Open;
        job.claimed_at = 0;
        if !job.is_direct_hire {
            job.worker = Pubkey::default();
        }

        emit!(JobReleased {
            escrow: job.key(),
            expired,
        });

        Ok(())
    }

    /// Worker agent records the SHA-256 hash of its delivered work on-chain.
    pub fn submit_work(ctx: Context<SubmitWork>, deliverable_hash: [u8; 32]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let job = &mut ctx.accounts.job_escrow;

        require!(job.status == JobStatus::Claimed, EscrowError::InvalidStatus);
        require!(ctx.accounts.worker.key() == job.worker, EscrowError::UnauthorizedWorker);
        require!(now <= job.claimed_at + job.deadline_secs, EscrowError::ClaimExpired);

        job.deliverable_hash = deliverable_hash;
        job.submitted_at = now;
        job.status = JobStatus::Submitted;

        emit!(WorkSubmitted {
            escrow: job.key(),
            worker: job.worker,
            deliverable_hash,
            submitted_at: now,
        });

        Ok(())
    }

    /// Poster requests revisions on submitted work (up to max_revisions).
    pub fn request_revision(ctx: Context<RequestRevision>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let config = &ctx.accounts.config;
        let job = &mut ctx.accounts.job_escrow;

        require!(job.status == JobStatus::Submitted, EscrowError::InvalidStatus);
        require!(ctx.accounts.poster.key() == job.poster, EscrowError::UnauthorizedPoster);
        require!(job.revisions < config.max_revisions, EscrowError::MaxRevisionsReached);

        job.revisions = job.revisions.checked_add(1).ok_or(EscrowError::MathOverflow)?;
        job.status = JobStatus::Claimed;
        job.claimed_at = now;
        job.submitted_at = 0;

        emit!(RevisionRequested {
            escrow: job.key(),
            revisions: job.revisions,
        });

        Ok(())
    }

    /// Accepts delivered work (or auto-releases after the review window) and splits funds:
    /// (100% - fee_bps) to worker, fee_bps to platform treasury, rent returned to poster.
    pub fn accept_and_release(ctx: Context<AcceptAndRelease>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let config = &ctx.accounts.config;
        let job = &ctx.accounts.job_escrow;

        require!(job.status == JobStatus::Submitted, EscrowError::InvalidStatus);

        let auto_eligible = now >= job.submitted_at + config.review_window_secs;
        require!(
            ctx.accounts.poster.is_signer || auto_eligible,
            EscrowError::ReviewWindowActive
        );

        let (payout, fee) = split_amount(job.amount_lamports, job.fee_bps)?;
        disburse_escrow(
            &ctx.accounts.job_escrow.to_account_info(),
            &ctx.accounts.worker.to_account_info(),
            &ctx.accounts.treasury.to_account_info(),
            payout,
            fee,
        )?;

        emit!(JobSettled {
            escrow: job.key(),
            poster: job.poster,
            worker: job.worker,
            payout_lamports: payout,
            fee_lamports: fee,
            auto_released: !ctx.accounts.poster.is_signer,
        });

        Ok(())
    }

    /// Cancels an Open (unclaimed) job and returns 100% of escrowed SOL + rent to poster.
    pub fn cancel_job(ctx: Context<CancelJob>) -> Result<()> {
        let job = &ctx.accounts.job_escrow;
        require!(job.status == JobStatus::Open, EscrowError::InvalidStatus);
        require!(ctx.accounts.poster.key() == job.poster, EscrowError::UnauthorizedPoster);

        emit!(JobCancelled {
            escrow: job.key(),
            poster: job.poster,
            refunded_lamports: job.amount_lamports,
        });

        // `close = poster` returns all lamports (escrow + rent) to poster.
        Ok(())
    }

    /// Poster flags a submitted job as Disputed for admin/arbiter resolution.
    pub fn dispute_job(ctx: Context<DisputeJob>) -> Result<()> {
        let job = &mut ctx.accounts.job_escrow;
        require!(job.status == JobStatus::Submitted, EscrowError::InvalidStatus);
        require!(ctx.accounts.poster.key() == job.poster, EscrowError::UnauthorizedPoster);

        job.status = JobStatus::Disputed;

        emit!(JobDisputed {
            escrow: job.key(),
            poster: job.poster,
            worker: job.worker,
        });

        Ok(())
    }

    /// Platform authority resolves a disputed job either in favor of worker or poster.
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, pay_worker: bool) -> Result<()> {
        let job = &ctx.accounts.job_escrow;
        require!(job.status == JobStatus::Disputed, EscrowError::InvalidStatus);

        let mut payout = 0u64;
        let mut fee = 0u64;

        if pay_worker {
            let split = split_amount(job.amount_lamports, job.fee_bps)?;
            payout = split.0;
            fee = split.1;
            disburse_escrow(
                &ctx.accounts.job_escrow.to_account_info(),
                &ctx.accounts.worker.to_account_info(),
                &ctx.accounts.treasury.to_account_info(),
                payout,
                fee,
            )?;
        }

        emit!(DisputeResolved {
            escrow: job.key(),
            pay_worker,
            payout_lamports: payout,
            fee_lamports: fee,
        });

        // Remaining lamports (or 100% if refunded) return to `poster` via `close = poster`.
        Ok(())
    }
}

fn split_amount(amount: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let fee = ((amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(EscrowError::MathOverflow)?
        / 10_000u128) as u64;
    let payout = amount.checked_sub(fee).ok_or(EscrowError::MathOverflow)?;
    Ok((payout, fee))
}

fn disburse_escrow(
    escrow_info: &AccountInfo,
    worker_info: &AccountInfo,
    treasury_info: &AccountInfo,
    payout: u64,
    fee: u64,
) -> Result<()> {
    let total = payout.checked_add(fee).ok_or(EscrowError::MathOverflow)?;
    let current = escrow_info.lamports();
    let remaining = current.checked_sub(total).ok_or(EscrowError::MathOverflow)?;

    **escrow_info.try_borrow_mut_lamports()? = remaining;
    **worker_info.try_borrow_mut_lamports()? = worker_info
        .lamports()
        .checked_add(payout)
        .ok_or(EscrowError::MathOverflow)?;
    **treasury_info.try_borrow_mut_lamports()? = treasury_info
        .lamports()
        .checked_add(fee)
        .ok_or(EscrowError::MathOverflow)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Account Contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = authority,
        space = PlatformConfig::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, PlatformConfig>,
    /// CHECK: Treasury wallet address receiving fees.
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlatform<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, PlatformConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(job_seed: [u8; 32])]
pub struct InitializeJob<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        init,
        payer = poster,
        space = JobEscrow::LEN,
        seeds = [b"job", poster.key().as_ref(), &job_seed],
        bump
    )]
    pub job_escrow: Account<'info, JobEscrow>,
    #[account(mut)]
    pub poster: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimJob<'info> {
    #[account(
        mut,
        seeds = [b"job", job_escrow.poster.as_ref(), &job_escrow.job_seed],
        bump = job_escrow.bump
    )]
    pub job_escrow: Account<'info, JobEscrow>,
    pub worker: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReleaseClaim<'info> {
    #[account(
        mut,
        seeds = [b"job", job_escrow.poster.as_ref(), &job_escrow.job_seed],
        bump = job_escrow.bump
    )]
    pub job_escrow: Account<'info, JobEscrow>,
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct SubmitWork<'info> {
    #[account(
        mut,
        seeds = [b"job", job_escrow.poster.as_ref(), &job_escrow.job_seed],
        bump = job_escrow.bump
    )]
    pub job_escrow: Account<'info, JobEscrow>,
    pub worker: Signer<'info>,
}

#[derive(Accounts)]
pub struct RequestRevision<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        mut,
        seeds = [b"job", job_escrow.poster.as_ref(), &job_escrow.job_seed],
        bump = job_escrow.bump
    )]
    pub job_escrow: Account<'info, JobEscrow>,
    pub poster: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptAndRelease<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = treasury
    )]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        mut,
        close = poster,
        seeds = [b"job", job_escrow.poster.as_ref(), &job_escrow.job_seed],
        bump = job_escrow.bump,
        has_one = poster,
        has_one = worker
    )]
    pub job_escrow: Account<'info, JobEscrow>,
    /// CHECK: Verified by `has_one = poster`; signer check enforced in handler unless auto-release window elapsed.
    #[account(mut)]
    pub poster: UncheckedAccount<'info>,
    /// CHECK: Verified by `has_one = worker`.
    #[account(mut)]
    pub worker: UncheckedAccount<'info>,
    /// CHECK: Verified by `has_one = treasury`.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CancelJob<'info> {
    #[account(
        mut,
        close = poster,
        seeds = [b"job", job_escrow.poster.as_ref(), &job_escrow.job_seed],
        bump = job_escrow.bump,
        has_one = poster
    )]
    pub job_escrow: Account<'info, JobEscrow>,
    #[account(mut)]
    pub poster: Signer<'info>,
}

#[derive(Accounts)]
pub struct DisputeJob<'info> {
    #[account(
        mut,
        seeds = [b"job", job_escrow.poster.as_ref(), &job_escrow.job_seed],
        bump = job_escrow.bump
    )]
    pub job_escrow: Account<'info, JobEscrow>,
    pub poster: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority,
        has_one = treasury
    )]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        mut,
        close = poster,
        seeds = [b"job", job_escrow.poster.as_ref(), &job_escrow.job_seed],
        bump = job_escrow.bump,
        has_one = poster,
        has_one = worker
    )]
    pub job_escrow: Account<'info, JobEscrow>,
    /// CHECK: Verified by `has_one = poster`.
    #[account(mut)]
    pub poster: UncheckedAccount<'info>,
    /// CHECK: Verified by `has_one = worker`.
    #[account(mut)]
    pub worker: UncheckedAccount<'info>,
    /// CHECK: Verified by `has_one = treasury`.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    pub authority: Signer<'info>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct PlatformUpdated {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct JobCreated {
    pub escrow: Pubkey,
    pub poster: Pubkey,
    pub amount_lamports: u64,
    pub fee_bps: u16,
    pub job_seed: [u8; 32],
}

#[event]
pub struct JobClaimed {
    pub escrow: Pubkey,
    pub worker: Pubkey,
    pub claimed_at: i64,
}

#[event]
pub struct JobReleased {
    pub escrow: Pubkey,
    pub expired: bool,
}

#[event]
pub struct WorkSubmitted {
    pub escrow: Pubkey,
    pub worker: Pubkey,
    pub deliverable_hash: [u8; 32],
    pub submitted_at: i64,
}

#[event]
pub struct RevisionRequested {
    pub escrow: Pubkey,
    pub revisions: u8,
}

#[event]
pub struct JobSettled {
    pub escrow: Pubkey,
    pub poster: Pubkey,
    pub worker: Pubkey,
    pub payout_lamports: u64,
    pub fee_lamports: u64,
    pub auto_released: bool,
}

#[event]
pub struct JobCancelled {
    pub escrow: Pubkey,
    pub poster: Pubkey,
    pub refunded_lamports: u64,
}

#[event]
pub struct JobDisputed {
    pub escrow: Pubkey,
    pub poster: Pubkey,
    pub worker: Pubkey,
}

#[event]
pub struct DisputeResolved {
    pub escrow: Pubkey,
    pub pay_worker: bool,
    pub payout_lamports: u64,
    pub fee_lamports: u64,
}
