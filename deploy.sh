#!/bin/bash
# Auron savings-vault deployment script
# Run from the D:\Auron directory in WSL:
#   wsl -- bash deploy.sh

set -e

export PATH="/home/$(whoami)/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

echo "=== Auron Savings Vault Deployment ==="
echo ""

# Verify tools
echo "Solana: $(solana --version)"
echo "Anchor: $(anchor --version)"
echo ""

# Switch to devnet
solana config set --url devnet
echo "Network: devnet"

BALANCE=$(solana balance --lamports | awk '{print $1}')
echo "Wallet balance: $BALANCE lamports"

if [ "$BALANCE" -lt 2000000000 ]; then
  echo ""
  echo "ERROR: Need at least 2 SOL to deploy."
  echo "Get devnet SOL from: https://faucet.solana.com"
  echo "Wallet: $(solana address)"
  exit 1
fi

echo ""
echo "Building program..."
anchor build

# Get the program ID from the built binary
PROGRAM_ID=$(solana-keygen pubkey target/deploy/savings_vault-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Update Anchor.toml and lib.rs with the real program ID
sed -i "s/6d73yQjrJXB96WTzBu2B3z4n5Gh42a51Am3nYAdHLrNv/$PROGRAM_ID/g" Anchor.toml
sed -i "s/6d73yQjrJXB96WTzBu2B3z4n5Gh42a51Am3nYAdHLrNv/$PROGRAM_ID/g" programs/savings-vault/src/lib.rs
sed -i "s/6d73yQjrJXB96WTzBu2B3z4n5Gh42a51Am3nYAdHLrNv/$PROGRAM_ID/g" frontend/lib/savings-vault.ts

echo ""
echo "Rebuilding with correct program ID..."
anchor build

echo ""
echo "Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo ""
echo "============================================"
echo "SUCCESS: Savings vault deployed!"
echo "Program ID: $PROGRAM_ID"
echo "View on Solscan: https://solscan.io/account/$PROGRAM_ID?cluster=devnet"
echo "============================================"
echo ""
echo "Next: Update NEXT_PUBLIC_SAVINGS_VAULT_PROGRAM_ID=$PROGRAM_ID in Vercel env vars"
