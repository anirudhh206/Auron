use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized — only vault owner can withdraw")]
    Unauthorized {},

    #[error("Vault not found: {id}")]
    NotFound { id: String },

    #[error("Vault is still locked until timestamp {unlock_at}")]
    StillLocked { unlock_at: u64 },

    #[error("Vault already withdrawn")]
    AlreadyWithdrawn {},

    #[error("Amount must be greater than zero")]
    ZeroAmount {},

    #[error("Unlock time must be in the future")]
    UnlockInPast {},

    #[error("Insufficient funds sent to cover amount plus fee")]
    InsufficientFunds {},

    #[error("No yield accrued yet — try again later")]
    NoYieldAccrued {},
}
