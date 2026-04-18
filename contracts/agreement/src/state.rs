use cw_storage_plus::{Item, Map};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Config {
    pub treasury: String,
    pub fee_amount: u128,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Agreement {
    pub agreement_id: String,
    pub content_hash: String,
    pub party_a: String,
    pub party_b: String,
    pub description: String,
    pub timestamp: u64,
    pub cosigned: bool,
    pub cosign_timestamp: Option<u64>,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const AGREEMENT_COUNT: Item<u64> = Item::new("agreement_count");
/// Key: agreement_id
pub const AGREEMENTS: Map<&str, Agreement> = Map::new("agreements");
/// Index: (address, agreement_id) for listing by participant
pub const ADDRESS_AGREEMENTS: Map<(&str, &str), bool> = Map::new("addr_agreements");
