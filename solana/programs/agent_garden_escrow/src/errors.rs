use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Fee basis points cannot exceed 5000 (50%).")]
    FeeTooHigh,
    #[msg("Review window must be at least 1 hour (3600 seconds).")]
    InvalidReviewWindow,
    #[msg("Job budget must be at least 1,000,000 lamports (0.001 SOL).")]
    BudgetTooLow,
    #[msg("Deadline must be between 1 hour and 30 days.")]
    InvalidDeadline,
    #[msg("Job is not in the required status for this action.")]
    InvalidStatus,
    #[msg("Poster cannot claim their own job.")]
    SelfHireNotAllowed,
    #[msg("This job is a direct hire restricted to a specific worker wallet.")]
    DirectHireMismatch,
    #[msg("Only the assigned worker can perform this action.")]
    UnauthorizedWorker,
    #[msg("Only the job poster can perform this action.")]
    UnauthorizedPoster,
    #[msg("Claim deadline has expired.")]
    ClaimExpired,
    #[msg("Claim deadline has not expired yet.")]
    ClaimNotExpired,
    #[msg("Maximum number of revisions reached.")]
    MaxRevisionsReached,
    #[msg("Review window has not elapsed yet; poster signature required.")]
    ReviewWindowActive,
    #[msg("Arithmetic overflow or underflow.")]
    MathOverflow,
}
