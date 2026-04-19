use cw_storage_plus::{Item, Map};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Config {
    pub treasury: String,
    pub fee_amount: u128,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct OwnershipRecord {
    pub file_hash: String,
    pub owner: String,
    pub file_name: String,
    pub description: String,
    pub timestamp: u64,
    pub block_height: u64,
}

pub const CONFIG: Item<Config> = Item::new("config");
/// Key: file_hash (SHA-256 hex)
pub const OWNERSHIP: Map<&str, OwnershipRecord> = Map::new("ownership");
/// Index: (owner, file_hash)
pub const OWNER_STAMPS: Map<(&str, &str), bool> = Map::new("owner_stamps");
