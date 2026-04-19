use cosmwasm_std::Uint128;
use cw_storage_plus::{Item, Map};
use serde::{Deserialize, Serialize};

/// Contract configuration with validator for delegation
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Config {
    pub treasury: String,
    pub fee_bps: u64,
    pub penalty_bps: u64,
    /// Validator address that receives delegations for yield
    pub validator_address: String,
}

/// Vault state with yield tracking
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Vault {
    pub vault_id: String,
    pub owner: String,
    /// Principal amount locked (not including yield)
    pub amount: Uint128,
    /// Unix timestamp when funds unlock
    pub unlock_at: u64,
    pub label: String,
    pub created_at: u64,
    pub withdrawn: bool,
    /// Amount delegated to validator for earning rewards
    pub delegated_amount: Uint128,
    /// Last time rewards were claimed from validator
    pub last_reward_claim: u64,
    /// Total staking rewards accumulated and claimed
    pub total_yield_claimed: Uint128,
}

// ─── Storage ──────────────────────────────────────────────────────────────────
pub const CONFIG: Item<Config> = Item::new("config");
pub const VAULT_COUNT: Item<u64> = Item::new("vault_count");
/// Key: vault_id → Vault state
pub const VAULTS: Map<&str, Vault> = Map::new("vaults");
/// Index: (owner, vault_id) → bool (for listing by owner)
pub const OWNER_VAULTS: Map<(&str, &str), bool> = Map::new("owner_vaults");
