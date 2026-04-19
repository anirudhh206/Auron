use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Uint128;

#[cw_serde]
pub struct InstantiateMsg {
    /// Address that receives the platform fee
    pub treasury: String,
    /// Fee in basis points (150 = 1.5%)
    pub fee_bps: u64,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Send tokens to a recipient with an optional note
    Transfer {
        to: String,
        amount: Uint128,
        note: Option<String>,
    },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    /// Paginated transaction history for an address
    #[returns(TransactionHistoryResponse)]
    TransactionHistory { address: String, limit: u32 },

    /// Contract config
    #[returns(ConfigResponse)]
    Config {},
}

#[cw_serde]
pub struct TransactionRecord {
    pub from: String,
    pub to: String,
    pub amount: Uint128,
    pub note: Option<String>,
    pub timestamp: u64,
    pub tx_id: u64,
}

#[cw_serde]
pub struct TransactionHistoryResponse {
    pub transactions: Vec<TransactionRecord>,
}

#[cw_serde]
pub struct ConfigResponse {
    pub treasury: String,
    pub fee_bps: u64,
}
