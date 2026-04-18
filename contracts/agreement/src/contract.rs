use cosmwasm_std::{
    attr, entry_point, to_json_binary, BankMsg, Binary, Coin, Deps, DepsMut, Env, MessageInfo,
    Order, Response, StdResult,
};

use crate::error::ContractError;
use crate::msg::{
    AgreementResponse, AgreementsListResponse, ExecuteMsg, InstantiateMsg, QueryMsg,
};
use crate::state::{Agreement, Config, ADDRESS_AGREEMENTS, AGREEMENT_COUNT, AGREEMENTS, CONFIG};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    deps.api.addr_validate(&msg.treasury)?;
    CONFIG.save(
        deps.storage,
        &Config {
            treasury: msg.treasury.clone(),
            fee_amount: msg.fee_amount,
        },
    )?;
    AGREEMENT_COUNT.save(deps.storage, &0u64)?;
    Ok(Response::new().add_attribute("action", "instantiate"))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Stamp {
            content_hash,
            party_b,
            description,
        } => execute_stamp(deps, env, info, content_hash, party_b, description),
        ExecuteMsg::Cosign { agreement_id } => execute_cosign(deps, env, info, agreement_id),
    }
}

fn execute_stamp(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    content_hash: String,
    party_b: String,
    description: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    if info.sender.to_string() == party_b {
        return Err(ContractError::SelfAgreement {});
    }

    deps.api.addr_validate(&party_b)?;

    // Check fee
    let sent = info
        .funds
        .iter()
        .find(|c| c.denom == "ucless")
        .map(|c| c.amount.u128())
        .unwrap_or(0);

    if sent < config.fee_amount {
        return Err(ContractError::InsufficientFee {
            expected: config.fee_amount,
        });
    }

    let count = AGREEMENT_COUNT.load(deps.storage)? + 1;
    AGREEMENT_COUNT.save(deps.storage, &count)?;

    let agreement_id = format!("agr-{}", count);

    let agreement = Agreement {
        agreement_id: agreement_id.clone(),
        content_hash,
        party_a: info.sender.to_string(),
        party_b: party_b.clone(),
        description,
        timestamp: env.block.time.seconds(),
        cosigned: false,
        cosign_timestamp: None,
    };

    AGREEMENTS.save(deps.storage, &agreement_id, &agreement)?;
    ADDRESS_AGREEMENTS.save(deps.storage, (info.sender.as_str(), &agreement_id), &true)?;
    ADDRESS_AGREEMENTS.save(deps.storage, (party_b.as_str(), &agreement_id), &true)?;

    let mut msgs = vec![];
    if config.fee_amount > 0 {
        msgs.push(BankMsg::Send {
            to_address: config.treasury,
            amount: vec![Coin {
                denom: "ucless".to_string(),
                amount: config.fee_amount.into(),
            }],
        });
    }

    Ok(Response::new()
        .add_messages(msgs)
        .add_attributes(vec![
            attr("action", "stamp"),
            attr("agreement_id", agreement_id),
            attr("party_a", info.sender.to_string()),
            attr("party_b", party_b),
        ]))
}

fn execute_cosign(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    agreement_id: String,
) -> Result<Response, ContractError> {
    let mut agreement = AGREEMENTS
        .load(deps.storage, &agreement_id)
        .map_err(|_| ContractError::NotFound {
            id: agreement_id.clone(),
        })?;

    if info.sender.to_string() != agreement.party_b {
        return Err(ContractError::Unauthorized {});
    }

    if agreement.cosigned {
        return Err(ContractError::AlreadyCosigned {});
    }

    agreement.cosigned = true;
    agreement.cosign_timestamp = Some(env.block.time.seconds());
    AGREEMENTS.save(deps.storage, &agreement_id, &agreement)?;

    Ok(Response::new().add_attributes(vec![
        attr("action", "cosign"),
        attr("agreement_id", agreement_id),
        attr("cosigner", info.sender.to_string()),
    ]))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetAgreement { agreement_id } => {
            to_json_binary(&query_agreement(deps, agreement_id)?)
        }
        QueryMsg::ListAgreements { address, limit } => {
            to_json_binary(&query_list_agreements(deps, address, limit)?)
        }
    }
}

fn query_agreement(deps: Deps, agreement_id: String) -> StdResult<AgreementResponse> {
    let a = AGREEMENTS.load(deps.storage, &agreement_id)?;
    Ok(AgreementResponse {
        agreement_id: a.agreement_id,
        content_hash: a.content_hash,
        party_a: a.party_a,
        party_b: a.party_b,
        description: a.description,
        timestamp: a.timestamp,
        cosigned: a.cosigned,
        cosign_timestamp: a.cosign_timestamp,
    })
}

fn query_list_agreements(
    deps: Deps,
    address: String,
    limit: u32,
) -> StdResult<AgreementsListResponse> {
    let limit = limit.min(50) as usize;
    let ids: Vec<String> = ADDRESS_AGREEMENTS
        .prefix(address.as_str())
        .range(deps.storage, None, None, Order::Descending)
        .take(limit)
        .map(|r| r.map(|(k, _)| k))
        .collect::<StdResult<Vec<_>>>()?;

    let agreements = ids
        .into_iter()
        .filter_map(|id| AGREEMENTS.load(deps.storage, &id).ok())
        .map(|a| AgreementResponse {
            agreement_id: a.agreement_id,
            content_hash: a.content_hash,
            party_a: a.party_a,
            party_b: a.party_b,
            description: a.description,
            timestamp: a.timestamp,
            cosigned: a.cosigned,
            cosign_timestamp: a.cosign_timestamp,
        })
        .collect();

    Ok(AgreementsListResponse { agreements })
}
