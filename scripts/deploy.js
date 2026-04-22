#!/usr/bin/env node
/**
 * Auron — Contract Deployment Script
 *
 * Deploys all 4 CosmWasm contracts to Initia testnet and:
 * 1. Uploads .wasm bytecode
 * 2. Instantiates each contract
 * 3. Saves addresses to .env.local automatically
 * 4. Updates submission.json
 *
 * Usage:
 *   node scripts/deploy.js
 *
 * Prerequisites:
 *   - Run scripts/build_contracts.sh first
 *   - Set DEPLOYER_MNEMONIC in .env.deploy (keep this file SECRET)
 *   - Have INIT tokens in deployer wallet for gas
 */

const fs = require("node:fs");
const path = require("node:path");

// ── Load env ────────────────────────────────────────────────────────────────
require("dotenv").config({ path: path.join(__dirname, ".env.deploy") });

const {
  DirectSecp256k1HdWallet,
  SigningCosmWasmClient,
} = require("@cosmjs/cosmwasm-stargate");
const { GasPrice } = require("@cosmjs/stargate");

// ── Config ──────────────────────────────────────────────────────────────────
const CONFIG = {
  rpcUrl:    process.env.RPC_URL    || "https://rpc.testnet.initia.xyz",
  chainId:   process.env.CHAIN_ID   || "auron-1",
  denom:     process.env.DENOM      || "ucless",
  gasPrice:  process.env.GAS_PRICE  || "0.025ucless",
  mnemonic:  process.env.DEPLOYER_MNEMONIC,
  treasury:  process.env.TREASURY_ADDRESS,
  validator: process.env.VALIDATOR_ADDRESS,
};

const ARTIFACTS_DIR = path.join(__dirname, "../artifacts");
const ENV_FILE      = path.join(__dirname, "../frontend/.env.local");
const SUBMISSION    = path.join(__dirname, "../.initia/submission.json");

// ── Validate config ─────────────────────────────────────────────────────────
function validateConfig() {
  const required = ["mnemonic", "treasury", "validator"];
  const missing = required.filter((k) => !CONFIG[k]);
  if (missing.length > 0) {
    console.error("❌ Missing required env vars in .env.deploy:");
    missing.forEach((k) => console.error(`   - ${k.toUpperCase().replace("mnemonic", "DEPLOYER_MNEMONIC")}`));
    console.error("\nCreate scripts/.env.deploy with these values.");
    process.exit(1);
  }
}

// ── Update .env.local with deployed addresses ────────────────────────────────
function updateEnvFile(addresses) {
  if (!fs.existsSync(ENV_FILE)) {
    console.warn("⚠️  .env.local not found, skipping env update");
    return;
  }

  let env = fs.readFileSync(ENV_FILE, "utf8");

  const updates = {
    NEXT_PUBLIC_TRANSFER_CONTRACT:  addresses.transfer,
    NEXT_PUBLIC_AGREEMENT_CONTRACT: addresses.agreement,
    NEXT_PUBLIC_TIMELOCK_CONTRACT:  addresses.timelock,
    NEXT_PUBLIC_OWNERSHIP_CONTRACT: addresses.ownership,
    NEXT_PUBLIC_TREASURY_ADDRESS:   CONFIG.treasury,
  };

  for (const [key, value] of Object.entries(updates)) {
    if (!value) continue;
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(env)) {
      env = env.replace(regex, `${key}=${value}`);
    } else {
      env += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(ENV_FILE, env);
  console.log("✅ .env.local updated with contract addresses");
}

// ── Update submission.json ───────────────────────────────────────────────────
function updateSubmission(addresses) {
  if (!fs.existsSync(SUBMISSION)) return;
  const data = JSON.parse(fs.readFileSync(SUBMISSION, "utf8"));
  data.contracts = addresses;
  data.chain_id = CONFIG.chainId;
  fs.writeFileSync(SUBMISSION, JSON.stringify(data, null, 2));
  console.log("✅ submission.json updated");
}

// ── Main deploy ──────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║   Auron — Deploying Contracts           ║");
  console.log("╚═══════════════════════════════════════╝\n");

  validateConfig();

  // Create wallet from mnemonic
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(CONFIG.mnemonic, {
    prefix: "init",
  });
  const [account] = await wallet.getAccounts();
  console.log(`🔑 Deployer: ${account.address}`);

  // Connect to chain
  const client = await SigningCosmWasmClient.connectWithSigner(
    CONFIG.rpcUrl,
    wallet,
    { gasPrice: GasPrice.fromString(CONFIG.gasPrice) }
  );

  // Check balance
  const balance = await client.getBalance(account.address, CONFIG.denom);
  console.log(`💰 Balance: ${balance.amount} ${balance.denom}`);
  if (BigInt(balance.amount) < BigInt(10_000_000)) {
    console.error("❌ Insufficient balance — need at least 10 CLESS for deployment");
    process.exit(1);
  }

  const addresses = {};

  // ── Deploy each contract ─────────────────────────────────────────────────
  const contracts = [
    {
      name: "transfer",
      wasm: "transfer.wasm",
      initMsg: {
        treasury: CONFIG.treasury,
        fee_bps: 150, // 1.5%
      },
    },
    {
      name: "agreement",
      wasm: "agreement.wasm",
      initMsg: {
        treasury: CONFIG.treasury,
        fee_amount: "5000000", // Rs5 in ucless
      },
    },
    {
      name: "timelock",
      wasm: "timelock.wasm",
      initMsg: {
        treasury: CONFIG.treasury,
        fee_bps: 50,         // 0.5%
        penalty_bps: 1000,   // 10% emergency penalty
        validator_address: CONFIG.validator,
      },
    },
    {
      name: "ownership",
      wasm: "ownership.wasm",
      initMsg: {
        treasury: CONFIG.treasury,
        fee_amount: "2000000", // Rs2 in ucless
      },
    },
  ];

  for (const contract of contracts) {
    const wasmPath = path.join(ARTIFACTS_DIR, contract.wasm);

    if (!fs.existsSync(wasmPath)) {
      console.error(`❌ ${contract.wasm} not found. Run scripts/build_contracts.sh first.`);
      process.exit(1);
    }

    console.log(`\n📦 Deploying ${contract.name}...`);

    // Upload wasm
    const wasm = fs.readFileSync(wasmPath);
    const uploadResult = await client.upload(account.address, wasm, "auto");
    console.log(`   Code ID: ${uploadResult.codeId}`);

    // Instantiate
    const { contractAddress } = await client.instantiate(
      account.address,
      uploadResult.codeId,
      contract.initMsg,
      `auron-${contract.name}`,
      "auto"
    );

    addresses[contract.name] = contractAddress;
    console.log(`   ✅ ${contract.name}: ${contractAddress}`);
  }

  // ── Save results ──────────────────────────────────────────────────────────
  console.log("\n\n📋 Deployed Addresses:");
  console.log("─".repeat(60));
  for (const [name, addr] of Object.entries(addresses)) {
    console.log(`   ${name.padEnd(12)}: ${addr}`);
  }
  console.log("─".repeat(60));

  // Save to addresses.json
  const deployOutput = {
    chain_id: CONFIG.chainId,
    deployer: account.address,
    deployed_at: new Date().toISOString(),
    contracts: addresses,
  };

  const outputPath = path.join(__dirname, "deployed_addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployOutput, null, 2));
  console.log(`\n✅ Saved to: scripts/deployed_addresses.json`);

  // Update .env.local
  updateEnvFile(addresses);

  // Update submission.json
  updateSubmission(addresses);

  console.log("\n🚀 Deployment complete!\n");
  console.log("Next steps:");
  console.log("  1. cd frontend && npm run dev");
  console.log("  2. Connect wallet and test all 4 actions");
  console.log("  3. Deploy frontend: vercel --prod");
  console.log("  4. Record demo video");
  console.log("  5. Submit at dorahacks.io\n");
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
});
