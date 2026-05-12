use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

declare_id!("B5DwqnCoDrY8ezfGaZfpAnvZ4FwCtPNHk6vT5nRgFENg");

#[program]
pub mod savings_vault {
    use super::*;

    /// Lock USDC into a time-locked PDA vault.
    /// Funds cannot be withdrawn before `unlock_timestamp`.
    pub fn lock_savings(
        ctx: Context<LockSavings>,
        amount: u64,
        unlock_timestamp: i64,
        label: String,
    ) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);
        require!(
            unlock_timestamp > Clock::get()?.unix_timestamp,
            VaultError::UnlockInPast
        );
        require!(label.len() <= 64, VaultError::LabelTooLong);

        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.mint = ctx.accounts.mint.key();
        vault.amount = amount;
        vault.unlock_timestamp = unlock_timestamp;
        vault.label = label;
        vault.bump = ctx.bumps.vault;
        vault.created_at = Clock::get()?.unix_timestamp;

        // Transfer USDC from owner → vault token account
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_token.to_account_info(),
                to: ctx.accounts.vault_token.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        emit!(SavingsLocked {
            owner: vault.owner,
            amount,
            unlock_timestamp,
            label: vault.label.clone(),
        });

        Ok(())
    }

    /// Withdraw USDC from vault after lock period expires.
    pub fn unlock_savings(ctx: Context<UnlockSavings>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= ctx.accounts.vault.unlock_timestamp,
            VaultError::StillLocked
        );

        let amount = ctx.accounts.vault.amount;
        let owner_key = ctx.accounts.vault.owner;
        let bump = ctx.accounts.vault.bump;

        // Sign with vault PDA
        let seeds: &[&[u8]] = &[b"vault", owner_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.owner_token.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, amount)?;

        emit!(SavingsUnlocked {
            owner: ctx.accounts.vault.owner,
            amount,
        });

        Ok(())
    }
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct LockSavings<'info> {
    #[account(
        init,
        payer = owner,
        space = SavingsVaultState::SIZE,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, SavingsVaultState>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_token: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnlockSavings<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
        close = owner,
    )]
    pub vault: Account<'info, SavingsVaultState>,

    #[account(
        mut,
        associated_token::mint = vault.mint,
        associated_token::authority = vault,
    )]
    pub vault_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = vault.mint,
        associated_token::authority = owner,
    )]
    pub owner_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ─── State ────────────────────────────────────────────────────────────────────

#[account]
pub struct SavingsVaultState {
    pub owner: Pubkey,          // 32
    pub mint: Pubkey,           // 32
    pub amount: u64,            // 8
    pub unlock_timestamp: i64,  // 8
    pub created_at: i64,        // 8
    pub bump: u8,               // 1
    pub label: String,          // 4 + 64
}

impl SavingsVaultState {
    pub const SIZE: usize = 8   // discriminator
        + 32                    // owner
        + 32                    // mint
        + 8                     // amount
        + 8                     // unlock_timestamp
        + 8                     // created_at
        + 1                     // bump
        + 4 + 64;               // label string
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct SavingsLocked {
    pub owner: Pubkey,
    pub amount: u64,
    pub unlock_timestamp: i64,
    pub label: String,
}

#[event]
pub struct SavingsUnlocked {
    pub owner: Pubkey,
    pub amount: u64,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum VaultError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Unlock time must be in the future")]
    UnlockInPast,
    #[msg("Vault is still locked — come back later")]
    StillLocked,
    #[msg("Label must be 64 characters or less")]
    LabelTooLong,
}
