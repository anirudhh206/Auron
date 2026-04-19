// Chain configuration for Auron Minitia
export const AURON_CHAIN_CONFIG = {
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID ?? "auron-1",
  chainName: "Auron",
  rpc: process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.auron.initia.xyz",
  rest: process.env.NEXT_PUBLIC_REST_URL ?? "https://rest.auron.initia.xyz",
  bech32Prefix: "init",
  feeDenom: "ucless",
  feeAmount: "2000",
  gasLimit: "200000",
  nativeDenom: {
    coinDenom: "CLESS",
    coinMinimalDenom: "ucless",
    coinDecimals: 6,
  },
};

// Contract addresses — filled after deployment
export const CONTRACTS = {
  transfer: process.env.NEXT_PUBLIC_TRANSFER_CONTRACT ?? "",
  agreement: process.env.NEXT_PUBLIC_AGREEMENT_CONTRACT ?? "",
  timelock: process.env.NEXT_PUBLIC_TIMELOCK_CONTRACT ?? "",
  ownership: process.env.NEXT_PUBLIC_OWNERSHIP_CONTRACT ?? "",
};

export const GAS_CONFIG = {
  amount: [{ denom: "ucless", amount: "2000" }],
  gas: "200000",
};
