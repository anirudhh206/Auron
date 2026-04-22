#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Auron — Build all CosmWasm contracts to optimized .wasm
# Requires: Rust, cargo, Docker (for cosmwasm-check)
# Usage: bash scripts/build_contracts.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT/contracts"
OUT_DIR="$ROOT/artifacts"

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   Auron — Building CosmWasm Contracts  ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ── Pre-checks ─────────────────────────────────────────────────────────────
if ! command -v cargo &> /dev/null; then
  echo "❌ Cargo not found. Install Rust: https://rustup.rs/"
  exit 1
fi

if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
  echo "📦 Adding wasm32-unknown-unknown target..."
  rustup target add wasm32-unknown-unknown
fi

mkdir -p "$OUT_DIR"

# ── Build each contract ─────────────────────────────────────────────────────
CONTRACTS=("transfer" "agreement" "timelock" "ownership")

for CONTRACT in "${CONTRACTS[@]}"; do
  echo "🔨 Building $CONTRACT..."

  cd "$CONTRACTS_DIR/$CONTRACT"

  RUSTFLAGS='-C link-arg=-s' cargo build \
    --release \
    --target wasm32-unknown-unknown \
    --locked \
    2>&1 | tail -5

  # Copy to artifacts
  WASM="$CONTRACTS_DIR/$CONTRACT/target/wasm32-unknown-unknown/release/$CONTRACT.wasm"

  if [ -f "$WASM" ]; then
    cp "$WASM" "$OUT_DIR/$CONTRACT.wasm"
    SIZE=$(du -k "$OUT_DIR/$CONTRACT.wasm" | cut -f1)
    echo "   ✅ $CONTRACT.wasm ($SIZE KB)"
  else
    echo "   ❌ Build failed for $CONTRACT"
    exit 1
  fi
done

echo ""
echo "✅ All contracts built successfully!"
echo "📁 Artifacts in: $OUT_DIR"
echo ""
ls -lh "$OUT_DIR"/*.wasm
echo ""
