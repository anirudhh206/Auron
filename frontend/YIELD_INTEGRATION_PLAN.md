# Yield Vault Integration Plan

## Overview
When a user locks Rs10,000 for 3 months, instead of it sitting idle:
1. Funds are auto-delegated to a validator on Initia
2. User earns ~12% APY (testnet validator rate)
3. Yield accrues daily (compounded)
4. User can claim yield anytime
5. On unlock, user gets principal + all accrued yield

## Strategy: Validator Delegation (Simplest for Testnet)

### Why Validator Delegation?
- No external dependency on yield protocols (testnet fragility)
- Standard Cosmos delegation (battle-tested)
- ~12% APY on Initia testnet
- Can be swapped to liquidity pools later (Phase 2)
- No smart contract risk (uses Cosmos SDK staking)

### Flow

```
User locks Rs10,000 for 3 months
        ↓
Timelock contract receives 10,000 CLESS
        ↓
Contract auto-delegates to validator "auron-validator"
        ↓
Validator starts earning rewards (~12% APY)
        ↓
Every block: rewards accumulate in contract
        ↓
User can claim yield anytime
        ↓
On unlock (after 3 months): full principal + yield transferred to user
```

### Contract Changes

**`timelock.wasm` updates:**
1. Add delegation to validator on `Lock` execution
2. Track delegated amount per vault
3. Query validator rewards (accumulated)
4. Calculate accrued yield per vault
5. Add `ClaimYield` function
6. On `Withdraw`: auto-undelegate all
7. Auto-claim rewards before transfer

**New messages:**
```rust
ExecuteMsg {
    Lock { amount, unlock_at, label },           // existing
    Withdraw { vault_id },                        // existing
    EmergencyWithdraw { vault_id },               // existing
    ClaimYield { vault_id },                      // new
}

QueryMsg {
    GetVault { vault_id },                        // existing
    ListVaults { owner, limit },                  // existing
    GetYieldAccrued { vault_id },                 // new
}
```

### Configuration

```rust
pub struct Config {
    pub treasury: String,
    pub fee_bps: u64,
    pub penalty_bps: u64,
    pub validator_address: String,               // new: "initvalcons1..."
}
```

## Frontend Integration

### 1. Update `ChatInterface.tsx`
- Show accrued yield in lock message
- Add "claim yield" option in transaction menu

### 2. New `YieldDisplay` Component
Shows in TransactionHistory for each lock:
```
💰 Principal: Rs10,000
📈 Accrued Yield: Rs1,200 (12% APY)
✓ Claimable now
```

### 3. Update API
- Add endpoint to query accrued yield
- Wire to transaction history display

## Security Considerations

✅ **No smart contract risk** — uses standard Cosmos delegation
✅ **User-controlled** — validator can be changed (Phase 2)
✅ **Transparent** — all yields accrue on-chain, queryable
✅ **Reversible** — auto-undelegates on unlock
❌ **No slashing protection** — if validator slashes, user loses (acceptable for testnet, Phase 2 adds insurance)

## Implementation Sequence

1. ✅ Understand Initia validator setup (already on testnet)
2. 🔨 Update timelock contract (add delegation, yield tracking)
3. 🔨 Deploy updated contract
4. 🔨 Update frontend to display yield
5. 🔨 Wire "claim yield" action
6. 🧪 Test with real locks (3-day test = ~0.1% yield visible)
7. 📊 Monitor validator rewards accumulation

## Testnet Validator Setup

On Initia testnet:
- Validator: `auron-validator` (we'll set this up or use existing)
- Commission: 0% (no cut to user)
- Reward rate: ~12% APY
- Block time: 100ms (fast reward distribution)

Query existing validators:
```bash
initiald query staking validators --chain-id auron-1
```

## Phase 2 Upgrades

Reserved for later:
- Add multiple validators (diversification)
- Swap to liquidity pools (higher yield, more complex)
- Yield insurance (slashing protection)
- Auto-compound (no manual claiming)
- Yield farming (use yield to mint more CLESS)

## Cost/Benefit

**For Auron:**
- Users earn 12% on locks (huge retention driver)
- Auron doesn't cut yield (transparent, builds trust)
- On-chain proof of yield (marketing differentiator)

**For Users:**
- Non-crypto: "Wow, I'm earning interest like a bank!"
- Crypto: "Real DeFi yield with auto-delegation!"
- Both: "My locked money is working for me"

**Competitive advantage:**
- None of the 34 hackathon projects have this
- First on Initia to offer auto-compounding locks
- Real use case (savings + interest)
