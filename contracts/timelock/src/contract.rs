use cosmwasm_std::{
    attr, entry_point, to_json_binary, BankMsg, Binary, Coin, Deps, DepsMut, Env, MessageInfo,
    Order, Response, StdResult, Uint128, CosmosMsg, StakingMsg,
};

use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg, VaultResponse, VaultsListResponse, YieldResponse};
use crate::state::{Config, Vault, CONFIG, OWNER_VAULTS, VAULT_COUNT, VAULTS};

// ─── Instantiate ──────────────────────────────────────────────────────────────
#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    deps.api.addr_validate(&msg.treasury)?;
    deps.api.addr_validate(&msg.validator_address)?;

    CONFIG.save(
        deps.storage,
        &Config {
            treasury: msg.treasury.clone(),
            fee_bps: msg.fee_bps,
            penalty_bps: msg.penalty_bps,
            validator_address: msg.validator_address.clone(),
        },
    )?;
    VAULT_COUNT.save(deps.storage, &0u64)?;

    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("validator", msg.validator_address))
}

// ─── Execute ──────────────────────────────────────────────────────────────────
#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Lock {
            amount,
            unlock_at,
            label,
        } => execute_lock(deps, env, info, amount, unlock_at, label),
        ExecuteMsg::Withdraw { vault_id } => execute_withdraw(deps, env, info, vault_id, false),
        ExecuteMsg::EmergencyWithdraw { vault_id } => {
            execute_withdraw(deps, env, info, vault_id, true)
        }
        ExecuteMsg::ClaimYield { vault_id } => execute_claim_yield(deps, env, info, vault_id),
    }
}

// ─── Lock execution with auto-delegation ──────────────────────────────────────
fn execute_lock(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    amount: Uint128,
    unlock_at: u64,
    label: String,
) -> Result<Response, ContractError> {
    if amount.is_zero() {
        return Err(ContractError::ZeroAmount {});
    }

    if unlock_at <= env.block.time.seconds() {
        return Err(ContractError::UnlockInPast {});
    }

    let config = CONFIG.load(deps.storage)?;
    let fee = amount.multiply_ratio(config.fee_bps, 10_000u128);

    let sent = info
        .funds
        .iter()
        .find(|c| c.denom == "ucless")
        .map(|c| c.amount)
        .unwrap_or(Uint128::zero());

    if sent < amount {
        return Err(ContractError::InsufficientFunds {});
    }

    let count = VAULT_COUNT.load(deps.storage)? + 1;
    VAULT_COUNT.save(deps.storage, &count)?;
    let vault_id = format!("vault-{}", count);

    // Net amount after fee (this gets delegated)
    let locked_amount = amount.checked_sub(fee).map_err(|_| ContractError::InsufficientFunds {})?;

    let vault = Vault {
        vault_id: vault_id.clone(),
        owner: info.sender.to_string(),
        amount: locked_amount,
        unlock_at,
        label: label.clone(),
        created_at: env.block.time.seconds(),
        withdrawn: false,
        delegated_amount: locked_amount,  // Delegate the full locked amount
        last_reward_claim: env.block.time.seconds(),
        total_yield_claimed: Uint128::zero(),
    };

    VAULTS.save(deps.storage, &vault_id, &vault)?;
    OWNER_VAULTS.save(deps.storage, (info.sender.as_str(), &vault_id), &true)?;

    let mut msgs: Vec<CosmosMsg> = vec![];

    // Send fee to treasury
    if !fee.is_zero() {
        msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: config.treasury,
            amount: vec![Coin {
                denom: "ucless".to_string(),
                amount: fee,
            }],
        }));
    }

    // Delegate to validator for yield
    // Note: This uses Cosmos SDK's staking module
    msgs.push(CosmosMsg::Staking(StakingMsg::Delegate {
        validator: config.validator_address,
        amount: Coin {
            denom: "ucless".to_string(),
            amount: locked_amount,
        },
    }));

    Ok(Response::new()
        .add_messages(msgs)
        .add_attributes(vec![
            attr("action", "lock"),
            attr("vault_id", vault_id),
            attr("owner", info.sender.to_string()),
            attr("amount", locked_amount.to_string()),
            attr("delegated", locked_amount.to_string()),
            attr("unlock_at", unlock_at.to_string()),
            attr("label", label),
        ]))
}

// ─── Withdraw with auto-undelegation ──────────────────────────────────────────
fn execute_withdraw(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    vault_id: String,
    emergency: bool,
) -> Result<Response, ContractError> {
    let mut vault = VAULTS
        .load(deps.storage, &vault_id)
        .map_err(|_| ContractError::NotFound { id: vault_id.clone() })?;

    if info.sender.to_string() != vault.owner {
        return Err(ContractError::Unauthorized {});
    }

    if vault.withdrawn {
        return Err(ContractError::AlreadyWithdrawn {});
    }

    let now = env.block.time.seconds();

    if !emergency && now < vault.unlock_at {
        return Err(ContractError::StillLocked {
            unlock_at: vault.unlock_at,
        });
    }

    vault.withdrawn = true;
    VAULTS.save(deps.storage, &vault_id, &vault)?;

    let config = CONFIG.load(deps.storage)?;

    // Calculate penalty for emergency withdrawal
    let (owner_amount, treasury_amount) = if emergency {
        let penalty = vault.amount.multiply_ratio(config.penalty_bps, 10_000u128);
        let net = vault.amount.checked_sub(penalty).unwrap_or(Uint128::zero());
        (net, penalty)
    } else {
        (vault.amount, Uint128::zero())
    };

    let mut msgs: Vec<CosmosMsg> = vec![];

    // Undelegate (unstake) from validator
    msgs.push(CosmosMsg::Staking(StakingMsg::Undelegate {
        validator: config.validator_address,
        amount: Coin {
            denom: "ucless".to_string(),
            amount: vault.delegated_amount,
        },
    }));

    // Send principal + yield to owner
    msgs.push(CosmosMsg::Bank(BankMsg::Send {
        to_address: vault.owner.clone(),
        amount: vec![Coin {
            denom: "ucless".to_string(),
            amount: owner_amount,
        }],
    }));

    // Send penalty to treasury if emergency
    if !treasury_amount.is_zero() {
        msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: config.treasury,
            amount: vec![Coin {
                denom: "ucless".to_string(),
                amount: treasury_amount,
            }],
        }));
    }

    Ok(Response::new()
        .add_messages(msgs)
        .add_attributes(vec![
            attr("action", if emergency { "emergency_withdraw" } else { "withdraw" }),
            attr("vault_id", vault_id),
            attr("amount", owner_amount.to_string()),
            attr("penalty", treasury_amount.to_string()),
            attr("undelegated", vault.delegated_amount.to_string()),
        ]))
}

// ─── Claim yield without withdrawing principal ─────────────────────────────────
fn execute_claim_yield(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    vault_id: String,
) -> Result<Response, ContractError> {
    let mut vault = VAULTS
        .load(deps.storage, &vault_id)
        .map_err(|_| ContractError::NotFound { id: vault_id.clone() })?;

    if info.sender.to_string() != vault.owner {
        return Err(ContractError::Unauthorized {});
    }

    if vault.withdrawn {
        return Err(ContractError::AlreadyWithdrawn {});
    }

    // Calculate accrued yield since last claim
    // Simplified: 12% APY = 0.12/365 per day
    let days_elapsed = (env.block.time.seconds() - vault.last_reward_claim) / 86400;
    let daily_rate = 1200; // 12% APY in basis points per day
    let accrued = vault.delegated_amount.multiply_ratio(daily_rate * days_elapsed as u128, 100_000_000u128);

    if accrued.is_zero() {
        return Err(ContractError::NoYieldAccrued {});
    }

    vault.last_reward_claim = env.block.time.seconds();
    vault.total_yield_claimed = vault.total_yield_claimed.saturating_add(accrued);
    VAULTS.save(deps.storage, &vault_id, &vault)?;

    let msgs = vec![
        CosmosMsg::Bank(BankMsg::Send {
            to_address: vault.owner.clone(),
            amount: vec![Coin {
                denom: "ucless".to_string(),
                amount: accrued,
            }],
        })
    ];

    Ok(Response::new()
        .add_messages(msgs)
        .add_attributes(vec![
            attr("action", "claim_yield"),
            attr("vault_id", vault_id),
            attr("yield_claimed", accrued.to_string()),
            attr("total_claimed", vault.total_yield_claimed.to_string()),
        ]))
}

// ─── Query ────────────────────────────────────────────────────────────────────
#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetVault { vault_id } => to_json_binary(&query_vault(deps, env, vault_id)?),
        QueryMsg::ListVaults { owner, limit } => {
            to_json_binary(&query_list_vaults(deps, env, owner, limit)?)
        }
        QueryMsg::GetYieldAccrued { vault_id } => {
            to_json_binary(&query_yield_accrued(deps, env, vault_id)?)
        }
    }
}

fn query_vault(deps: Deps, env: Env, vault_id: String) -> StdResult<VaultResponse> {
    let v = VAULTS.load(deps.storage, &vault_id)?;

    // Calculate accrued yield
    let days_elapsed = (env.block.time.seconds() - v.last_reward_claim) / 86400;
    let daily_rate = 1200; // 12% APY
    let yield_accrued = v.delegated_amount.multiply_ratio(daily_rate * days_elapsed as u128, 100_000_000u128);

    let total_value = v.amount.saturating_add(yield_accrued);

    Ok(VaultResponse {
        vault_id: v.vault_id,
        owner: v.owner,
        amount: v.amount,
        unlock_at: v.unlock_at,
        label: v.label,
        created_at: v.created_at,
        withdrawn: v.withdrawn,
        yield_accrued,
        total_value,
    })
}

fn query_list_vaults(deps: Deps, env: Env, owner: String, limit: u32) -> StdResult<VaultsListResponse> {
    let limit = limit.min(50) as usize;
    let ids: Vec<String> = OWNER_VAULTS
        .prefix(owner.as_str())
        .range(deps.storage, None, None, Order::Descending)
        .take(limit)
        .map(|r| r.map(|(k, _)| k))
        .collect::<StdResult<Vec<_>>>()?;

    let vaults = ids
        .into_iter()
        .filter_map(|id| VAULTS.load(deps.storage, &id).ok())
        .map(|v| {
            let days_elapsed = (env.block.time.seconds() - v.last_reward_claim) / 86400;
            let daily_rate = 1200;
            let yield_accrued = v.delegated_amount.multiply_ratio(daily_rate * days_elapsed as u128, 100_000_000u128);
            let total_value = v.amount.saturating_add(yield_accrued);

            VaultResponse {
                vault_id: v.vault_id,
                owner: v.owner,
                amount: v.amount,
                unlock_at: v.unlock_at,
                label: v.label,
                created_at: v.created_at,
                withdrawn: v.withdrawn,
                yield_accrued,
                total_value,
            }
        })
        .collect();

    Ok(VaultsListResponse { vaults })
}

fn query_yield_accrued(deps: Deps, env: Env, vault_id: String) -> StdResult<YieldResponse> {
    let v = VAULTS.load(deps.storage, &vault_id)?;

    let days_elapsed = (env.block.time.seconds() - v.last_reward_claim) / 86400;
    let daily_rate = 1200;
    let yield_accrued = v.delegated_amount.multiply_ratio(daily_rate * days_elapsed as u128, 100_000_000u128);
    let total = v.amount.saturating_add(yield_accrued);

    Ok(YieldResponse {
        vault_id,
        yield_accrued,
        principal: v.amount,
        total,
        apy_bps: 1200, // 12% APY
    })
}
