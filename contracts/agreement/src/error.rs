use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized — only party_b can cosign")]
    Unauthorized {},

    #[error("Agreement not found: {id}")]
    NotFound { id: String },

    #[error("Agreement already cosigned")]
    AlreadyCosigned {},

    #[error("Insufficient fee — expected {expected} ucless")]
    InsufficientFee { expected: u128 },

    #[error("Cannot stamp agreement with yourself as party_b")]
    SelfAgreement {},
}
