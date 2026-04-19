use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Uint128;

#[cw_serde]
pub struct InstantiateMsg {
    pub treasury: String,
    /// Fee in basis points (50 = 0.5%)
    pub fee_bps: u64,
    /// Emergency withdrawal penalty in basis points (1000 = 10%)
    pub penalty_bps: u64,
    /// Validator address for auto-delegation (earns ~12% APY)
    pub validator_address: String,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Create a new timelock vault with auto-yield delegation
    Lock {
        amount: Uint128,
        /// Unix timestamp when funds unlock
        unlock_at: u64,
        label: String,
    },
    /// Withdraw after unlock_at has passed (auto-undelegates and claims yield)
    Withdraw { vault_id: String },
    /// Emergency withdraw before unlock_at — incurs penalty_bps fee (auto-undelegates)
    EmergencyWithdraw { vault_id: String },
    /// Claim accrued staking rewards without withdrawing principal
    ClaimYield { vault_id: String },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(VaultResponse)]
    GetVault { vault_id: String },

    #[returns(VaultsListResponse)]
    ListVaults { owner: String, limit: u32 },

    /// Calculate accrued yield (staking rewards) for a vault
    #[returns(YieldResponse)]
    GetYieldAccrued { vault_id: String },
}

/// Full vault state with yield info
#[cw_serde]
pub struct VaultResponse {
    pub vault_id: String,
    pub owner: String,
    /// Principal amount locked
    pub amount: Uint128,
    /// Unix timestamp when funds unlock
    pub unlock_at: u64,
    pub label: String,
    pub created_at: u64,
    pub withdrawn: bool,
    /// Staking rewards accrued (auto-calculated from validator)
    pub yield_accrued: Uint128,
    /// Total value: principal + yield
    pub total_value: Uint128,
}

#[cw_serde]
pub struct VaultsListResponse {
    pub vaults: Vec<VaultResponse>,
}

/// Yield information for a vault
#[cw_serde]
pub struct YieldResponse {
    pub vault_id: String,
    /// Accrued staking rewards in ucless
    pub yield_accrued: Uint128,
    /// Principal locked
    pub principal: Uint128,
    /// Total: principal + yield
    pub total: Uint128,
    /// Annual percentage yield (approximate, ~12%)
    pub apy_bps: u64,
}
