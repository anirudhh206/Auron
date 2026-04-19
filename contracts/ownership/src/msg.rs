use cosmwasm_schema::{cw_serde, QueryResponses};

#[cw_serde]
pub struct InstantiateMsg {
    pub treasury: String,
    /// Flat fee in ucless per stamp
    pub fee_amount: u128,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Stamp a file hash with ownership — file never leaves the user's device
    StampOwnership {
        /// SHA-256 hex of the file, computed client-side
        file_hash: String,
        file_name: String,
        description: String,
    },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    /// Verify who owns a file hash and when it was stamped
    #[returns(OwnershipResponse)]
    VerifyOwnership { file_hash: String },

    /// List all stamps by an address
    #[returns(StampsListResponse)]
    ListStamps { owner: String, limit: u32 },
}

#[cw_serde]
pub struct OwnershipResponse {
    pub file_hash: String,
    pub owner: String,
    pub file_name: String,
    pub description: String,
    pub timestamp: u64,
    pub block_height: u64,
}

#[cw_serde]
pub struct StampsListResponse {
    pub stamps: Vec<OwnershipResponse>,
}
