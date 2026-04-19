use cosmwasm_std::{
    attr, entry_point, to_json_binary, BankMsg, Binary, Coin, Deps, DepsMut, Env, MessageInfo,
    Order, Response, StdResult, Uint128,
};

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, ExecuteMsg, InstantiateMsg, QueryMsg, TransactionHistoryResponse,
    TransactionRecord,
};
use crate::state::{Config, TxRecord, CONFIG, TX_COUNT, TX_HISTORY};

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
            fee_bps: msg.fee_bps,
        },
    )?;
    TX_COUNT.save(deps.storage, &0u64)?;
    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("treasury", msg.treasury))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Transfer { to, amount, note } => {
            execute_transfer(deps, env, info, to, amount, note)
        }
    }
}

fn execute_transfer(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    to: String,
    amount: Uint128,
    note: Option<String>,
) -> Result<Response, ContractError> {
    if amount.is_zero() {
        return Err(ContractError::ZeroAmount {});
    }

    deps.api
        .addr_validate(&to)
        .map_err(|_| ContractError::InvalidRecipient {
            reason: "invalid address format".to_string(),
        })?;

    let config = CONFIG.load(deps.storage)?;

    // Fee = amount * fee_bps / 10000
    let fee = amount
        .multiply_ratio(config.fee_bps, 10_000u128);
    let recipient_amount = amount.checked_sub(fee).map_err(|_| ContractError::InsufficientFunds {})?;

    // Verify enough funds sent
    let denom = "ucless";
    let sent = info
        .funds
        .iter()
        .find(|c| c.denom == denom)
        .map(|c| c.amount)
        .unwrap_or(Uint128::zero());

    if sent < amount {
        return Err(ContractError::InsufficientFunds {});
    }

    // Record transaction
    let tx_id = TX_COUNT.load(deps.storage)? + 1;
    TX_COUNT.save(deps.storage, &tx_id)?;

    let record = TxRecord {
        from: info.sender.to_string(),
        to: to.clone(),
        amount,
        note: note.clone(),
        timestamp: env.block.time.seconds(),
        tx_id,
    };

    TX_HISTORY.save(deps.storage, (info.sender.as_str(), tx_id), &record)?;
    TX_HISTORY.save(deps.storage, (to.as_str(), tx_id), &record)?;

    let mut messages = vec![BankMsg::Send {
        to_address: to.clone(),
        amount: vec![Coin {
            denom: denom.to_string(),
            amount: recipient_amount,
        }],
    }];

    if !fee.is_zero() {
        messages.push(BankMsg::Send {
            to_address: config.treasury.clone(),
            amount: vec![Coin {
                denom: denom.to_string(),
                amount: fee,
            }],
        });
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attributes(vec![
            attr("action", "transfer"),
            attr("from", info.sender.to_string()),
            attr("to", to),
            attr("amount", amount.to_string()),
            attr("fee", fee.to_string()),
            attr("tx_id", tx_id.to_string()),
            attr("note", note.unwrap_or_default()),
        ]))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::TransactionHistory { address, limit } => {
            to_json_binary(&query_tx_history(deps, address, limit)?)
        }
        QueryMsg::Config {} => to_json_binary(&query_config(deps)?),
    }
}

fn query_tx_history(
    deps: Deps,
    address: String,
    limit: u32,
) -> StdResult<TransactionHistoryResponse> {
    let limit = limit.min(50) as usize;
    let records: Vec<TxRecord> = TX_HISTORY
        .prefix(address.as_str())
        .range(deps.storage, None, None, Order::Descending)
        .take(limit)
        .map(|r| r.map(|(_, v)| v))
        .collect::<StdResult<Vec<_>>>()?;

    let transactions = records
        .into_iter()
        .map(|r| TransactionRecord {
            from: r.from,
            to: r.to,
            amount: r.amount,
            note: r.note,
            timestamp: r.timestamp,
            tx_id: r.tx_id,
        })
        .collect();

    Ok(TransactionHistoryResponse { transactions })
}

fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let config = CONFIG.load(deps.storage)?;
    Ok(ConfigResponse {
        treasury: config.treasury,
        fee_bps: config.fee_bps,
    })
}
