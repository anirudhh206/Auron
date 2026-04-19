use cosmwasm_std::Uint128;
use cw_storage_plus::{Item, Map};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Config {
    pub treasury: String,
    pub fee_bps: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct TxRecord {
    pub from: String,
    pub to: String,
    pub amount: Uint128,
    pub note: Option<String>,
    pub timestamp: u64,
    pub tx_id: u64,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const TX_COUNT: Item<u64> = Item::new("tx_count");
/// Key: (address, tx_id) — stores tx records per participant
pub const TX_HISTORY: Map<(&str, u64), TxRecord> = Map::new("tx_history");
