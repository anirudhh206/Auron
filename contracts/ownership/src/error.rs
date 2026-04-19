use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("File hash already stamped — ownership already recorded")]
    AlreadyStamped {},

    #[error("File hash not found")]
    NotFound {},

    #[error("Insufficient fee — expected {expected} ucless")]
    InsufficientFee { expected: u128 },

    #[error("File hash must be a 64-character SHA-256 hex string")]
    InvalidHash {},
}
