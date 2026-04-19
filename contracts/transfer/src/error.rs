use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Invalid recipient address: {reason}")]
    InvalidRecipient { reason: String },

    #[error("Amount must be greater than zero")]
    ZeroAmount {},

    #[error("Insufficient funds sent to cover amount plus fee")]
    InsufficientFunds {},
}
