import { CONTRACTS } from "./initia";

// ─── Message builders for each contract ──────────────────────────────────────

export function buildTransferMsg(
  contractAddress: string,
  sender: string,
  recipient: string,
  amount: string,
  note?: string
) {
  return {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender,
      contract: contractAddress || CONTRACTS.transfer,
      msg: Buffer.from(
        JSON.stringify({
          transfer: {
            to: recipient,
            amount,
            note: note ?? null,
          },
        })
      ).toString("base64"),
      funds: [{ denom: "ucless", amount }],
    },
  };
}

export function buildStampAgreementMsg(
  contractAddress: string,
  sender: string,
  contentHash: string,
  partyB: string,
  description: string,
  feeAmount: string
) {
  return {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender,
      contract: contractAddress || CONTRACTS.agreement,
      msg: Buffer.from(
        JSON.stringify({
          stamp: {
            content_hash: contentHash,
            party_b: partyB,
            description,
          },
        })
      ).toString("base64"),
      funds: [{ denom: "ucless", amount: feeAmount }],
    },
  };
}

export function buildLockMsg(
  contractAddress: string,
  sender: string,
  amount: string,
  unlockAt: number,
  label: string
) {
  return {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender,
      contract: contractAddress || CONTRACTS.timelock,
      msg: Buffer.from(
        JSON.stringify({
          lock: {
            amount,
            unlock_at: unlockAt,
            label,
          },
        })
      ).toString("base64"),
      funds: [{ denom: "ucless", amount }],
    },
  };
}

export function buildStampOwnershipMsg(
  contractAddress: string,
  sender: string,
  fileHash: string,
  fileName: string,
  description: string,
  feeAmount: string
) {
  return {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender,
      contract: contractAddress || CONTRACTS.ownership,
      msg: Buffer.from(
        JSON.stringify({
          stamp_ownership: {
            file_hash: fileHash,
            file_name: fileName,
            description,
          },
        })
      ).toString("base64"),
      funds: [{ denom: "ucless", amount: feeAmount }],
    },
  };
}

export function buildClaimYieldMsg(
  contractAddress: string,
  sender: string,
  vaultId: string
) {
  return {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender,
      contract: contractAddress || CONTRACTS.timelock,
      msg: Buffer.from(
        JSON.stringify({
          claim_yield: {
            vault_id: vaultId,
          },
        })
      ).toString("base64"),
      funds: [],
    },
  };
}

export { GAS_CONFIG } from "./initia";
