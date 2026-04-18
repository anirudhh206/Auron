use cosmwasm_schema::{cw_serde, QueryResponses};

#[cw_serde]
pub struct InstantiateMsg {
    pub treasury: String,
    /// Flat fee in ucless per agreement stamp
    pub fee_amount: u128,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Party A stamps an agreement — creates pending agreement awaiting cosign
    Stamp {
        content_hash: String,
        party_b: String,
        description: String,
    },
    /// Party B cosigns an existing agreement — finalizes it
    Cosign { agreement_id: String },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(AgreementResponse)]
    GetAgreement { agreement_id: String },

    #[returns(AgreementsListResponse)]
    ListAgreements { address: String, limit: u32 },
}

#[cw_serde]
pub struct AgreementResponse {
    pub agreement_id: String,
    pub content_hash: String,
    pub party_a: String,
    pub party_b: String,
    pub description: String,
    pub timestamp: u64,
    pub cosigned: bool,
    pub cosign_timestamp: Option<u64>,
}

#[cw_serde]
pub struct AgreementsListResponse {
    pub agreements: Vec<AgreementResponse>,
}
