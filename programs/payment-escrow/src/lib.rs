use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

declare_id!("EsCRoW1111111111111111111111111111111111111");

/// Auron Payment Escrow Program
///
/// Provides on-chain enforcement for the settlement lifecycle:
///
///   1. deposit_for_payment  — User deposits USDC into an escrow PDA.
///                             The server cannot move funds until on-chain proof exists.
///   2. release_to_treasury  — Server (Auron signer) releases USDC → treasury after
///                             verifying the payment record. Triggers fiat settlement.
///   3. refund_to_user       — Server triggers on-chain USDC return on terminal failure.
///                             Auto-refund is provable: user can verify on-chain.
///
/// Trust model:
///   - Funds are never accessible to Auron until on-chain proof is verified server-side.
///   - If the Auron server goes offline, the user can reclaim after ESCROW_TIMEOUT_SECONDS.
///   - All state is on-chain: no failure can permanently strand funds.
#[program]
pub mod payment_escrow {
    use super::*;

    /// Step 1 — User locks USDC into an escrow PDA for a specific payment.
    /// Called BEFORE the settlement request is sent to the server.
    /// The escrow PDA is keyed by [b"escrow", payment_id] — one escrow per payment ID.
    pub fn deposit_for_payment(
        ctx: Context<DepositForPayment>,
        payment_id: String,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::ZeroAmount);
        require!(payment_id.len() >= 4 && payment_id.len() <= 64, EscrowError::InvalidPaymentId);

        let escrow = &mut ctx.accounts.escrow;
        escrow.payment_id       = payment_id.clone();
        escrow.user             = ctx.accounts.user.key();
        escrow.treasury         = ctx.accounts.treasury.key();
        escrow.mint             = ctx.accounts.mint.key();
        escrow.amount           = amount;
        escrow.status           = EscrowStatus::Deposited;
        escrow.deposited_at     = Clock::get()?.unix_timestamp;
        escrow.bump             = ctx.bumps.escrow;

        // Transfer USDC: user → escrow token account
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.user_token.to_account_info(),
                    to:        ctx.accounts.escrow_token.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(PaymentDeposited {
            payment_id,
            user: escrow.user,
            amount,
        });

        Ok(())
    }

    /// Step 2 — Server releases USDC from escrow → Auron treasury.
    /// Called after server-side on-chain verification passes (7-step gate).
    /// Requires the Auron server signer — not callable by the user.
    pub fn release_to_treasury(ctx: Context<ReleaseToTreasury>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Deposited,
            EscrowError::AlreadyProcessed
        );

        let amount      = escrow.amount;
        let payment_id  = escrow.payment_id.clone();
        let user_key    = escrow.user;
        let bump        = escrow.bump;

        escrow.status       = EscrowStatus::Released;
        escrow.released_at  = Some(Clock::get()?.unix_timestamp);

        // Sign transfer with escrow PDA
        let seeds: &[&[u8]] = &[b"escrow", payment_id.as_bytes(), &[bump]];
        let signer_seeds    = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.escrow_token.to_account_info(),
                    to:        ctx.accounts.treasury_token.to_account_info(),
                    authority: escrow.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        emit!(PaymentReleased {
            payment_id,
            user: user_key,
            amount,
        });

        Ok(())
    }

    /// Step 3 — Server returns USDC from escrow → user's wallet.
    /// Called on terminal failures: FX expiry, provider rejection, liquidity gap.
    /// Also callable by the user directly if ESCROW_TIMEOUT_SECONDS have passed —
    /// this prevents permanent fund loss if the Auron server goes offline.
    pub fn refund_to_user(ctx: Context<RefundToUser>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Deposited,
            EscrowError::AlreadyProcessed
        );

        // Server can refund any time. User can self-refund after timeout.
        let is_server  = ctx.accounts.signer.key() == ctx.accounts.escrow.treasury;
        let now        = Clock::get()?.unix_timestamp;
        let timed_out  = now > escrow.deposited_at + ESCROW_TIMEOUT_SECONDS;

        require!(is_server || timed_out, EscrowError::TimeoutNotReached);

        let amount      = escrow.amount;
        let payment_id  = escrow.payment_id.clone();
        let user_key    = escrow.user;
        let bump        = escrow.bump;

        escrow.status       = EscrowStatus::Refunded;
        escrow.released_at  = Some(now);

        let seeds: &[&[u8]] = &[b"escrow", payment_id.as_bytes(), &[bump]];
        let signer_seeds    = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.escrow_token.to_account_info(),
                    to:        ctx.accounts.user_token.to_account_info(),
                    authority: escrow.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        emit!(PaymentRefunded {
            payment_id,
            user: user_key,
            amount,
        });

        Ok(())
    }
}

/// Funds stranded in escrow for longer than this can be self-refunded by the user.
/// 30 minutes — generous enough for slow networks, tight enough for UX.
const ESCROW_TIMEOUT_SECONDS: i64 = 30 * 60;

// ─── Accounts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(payment_id: String)]
pub struct DepositForPayment<'info> {
    #[account(
        init,
        payer = user,
        space = EscrowState::size(&payment_id),
        seeds = [b"escrow", payment_id.as_bytes()],
        bump,
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token: Account<'info, TokenAccount>,

    /// CHECK: Treasury address validated against escrow.treasury on release/refund
    pub treasury: AccountInfo<'info>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program:            Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program:           Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseToTreasury<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.payment_id.as_bytes()],
        bump = escrow.bump,
        has_one = treasury,
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(
        mut,
        associated_token::mint = escrow.mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = escrow.mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token: Account<'info, TokenAccount>,

    /// CHECK: Must be the Auron treasury signer
    pub treasury: AccountInfo<'info>,

    /// Auron server signer — must be the treasury account
    #[account(mut, address = escrow.treasury)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundToUser<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.payment_id.as_bytes()],
        bump = escrow.bump,
        has_one = user @ EscrowError::Unauthorized,
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(
        mut,
        associated_token::mint = escrow.mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = escrow.mint,
        associated_token::authority = user,
    )]
    pub user_token: Account<'info, TokenAccount>,

    /// CHECK: Treasury address for server-triggered refunds
    pub treasury: AccountInfo<'info>,

    pub user: AccountInfo<'info>,

    /// Signer: either the Auron treasury (server refund) or the user (timeout refund)
    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ─── State ────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Deposited,
    Released,
    Refunded,
}

#[account]
pub struct EscrowState {
    pub payment_id:   String,       // 4 + len (max 64)
    pub user:         Pubkey,       // 32
    pub treasury:     Pubkey,       // 32
    pub mint:         Pubkey,       // 32
    pub amount:       u64,          // 8
    pub status:       EscrowStatus, // 1
    pub deposited_at: i64,          // 8
    pub released_at:  Option<i64>,  // 1 + 8
    pub bump:         u8,           // 1
}

impl EscrowState {
    pub fn size(payment_id: &str) -> usize {
        8       // discriminator
        + 4 + payment_id.len().min(64) // payment_id string
        + 32    // user
        + 32    // treasury
        + 32    // mint
        + 8     // amount
        + 1     // status enum
        + 8     // deposited_at
        + 9     // released_at (Option<i64>)
        + 1     // bump
        + 32    // padding
    }
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct PaymentDeposited {
    pub payment_id: String,
    pub user:       Pubkey,
    pub amount:     u64,
}

#[event]
pub struct PaymentReleased {
    pub payment_id: String,
    pub user:       Pubkey,
    pub amount:     u64,
}

#[event]
pub struct PaymentRefunded {
    pub payment_id: String,
    pub user:       Pubkey,
    pub amount:     u64,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Payment ID must be between 4 and 64 characters")]
    InvalidPaymentId,
    #[msg("Escrow has already been released or refunded")]
    AlreadyProcessed,
    #[msg("Timeout not reached — user cannot self-refund yet")]
    TimeoutNotReached,
    #[msg("Unauthorized — caller is not the escrow owner")]
    Unauthorized,
}
