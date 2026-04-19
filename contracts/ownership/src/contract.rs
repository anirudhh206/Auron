use cosmwasm_std::{
    attr, entry_point, to_json_binary, BankMsg, Binary, Coin, Deps, DepsMut, Env, MessageInfo,
    Order, Response, StdResult,
};

use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, OwnershipResponse, QueryMsg, StampsListResponse};
use crate::state::{Config, OwnershipRecord, CONFIG, OWNER_STAMPS, OWNERSHIP};

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
            treasury: msg.treasury,
            fee_amount: msg.fee_amount,
        },
    )?;
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
        ExecuteMsg::StampOwnership {
            file_hash,
            file_name,
            description,
        } => execute_stamp(deps, env, info, file_hash, file_name, description),
    }
}

fn execute_stamp(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    file_hash: String,
    file_name: String,
    description: String,
) -> Result<Response, ContractError> {
    // Validate SHA-256 hex: must be exactly 64 lowercase hex chars
    if file_hash.len() != 64 || !file_hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ContractError::InvalidHash {});
    }

    // Check not already stamped
    if OWNERSHIP.has(deps.storage, &file_hash) {
        return Err(ContractError::AlreadyStamped {});
    }

    let config = CONFIG.load(deps.storage)?;
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

    let record = OwnershipRecord {
        file_hash: file_hash.clone(),
        owner: info.sender.to_string(),
        file_name: file_name.clone(),
        description,
        timestamp: env.block.time.seconds(),
        block_height: env.block.height,
    };

    OWNERSHIP.save(deps.storage, &file_hash, &record)?;
    OWNER_STAMPS.save(deps.storage, (info.sender.as_str(), &file_hash), &true)?;

    let mut msgs = vec![];
    if config.fee_amount > 0 {
        msgs.push(BankMsg::Send {
            to_address: config.treasury.clone(),
            amount: vec![Coin {
                denom: "ucless".to_string(),
                amount: config.fee_amount.into(),
            }],
        });
    }

    Ok(Response::new()
        .add_messages(msgs)
        .add_attributes(vec![
            attr("action", "stamp_ownership"),
            attr("file_hash", file_hash),
            attr("owner", info.sender.to_string()),
            attr("file_name", file_name),
            attr("timestamp", env.block.time.seconds().to_string()),
        ]))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::VerifyOwnership { file_hash } => {
            to_json_binary(&query_verify(deps, file_hash)?)
        }
        QueryMsg::ListStamps { owner, limit } => {
            to_json_binary(&query_list_stamps(deps, owner, limit)?)
        }
    }
}

fn query_verify(deps: Deps, file_hash: String) -> StdResult<OwnershipResponse> {
    let r = OWNERSHIP.load(deps.storage, &file_hash)?;
    Ok(OwnershipResponse {
        file_hash: r.file_hash,
        owner: r.owner,
        file_name: r.file_name,
        description: r.description,
        timestamp: r.timestamp,
        block_height: r.block_height,
    })
}

fn query_list_stamps(deps: Deps, owner: String, limit: u32) -> StdResult<StampsListResponse> {
    let limit = limit.min(50) as usize;
    let hashes: Vec<String> = OWNER_STAMPS
        .prefix(owner.as_str())
        .range(deps.storage, None, None, Order::Descending)
        .take(limit)
        .map(|r| r.map(|(k, _)| k))
        .collect::<StdResult<Vec<_>>>()?;

    let stamps = hashes
        .into_iter()
        .filter_map(|h| OWNERSHIP.load(deps.storage, &h).ok())
        .map(|r| OwnershipResponse {
            file_hash: r.file_hash,
            owner: r.owner,
            file_name: r.file_name,
            description: r.description,
            timestamp: r.timestamp,
            block_height: r.block_height,
        })
        .collect();

    Ok(StampsListResponse { stamps })
}
