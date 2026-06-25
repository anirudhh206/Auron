import * as anchor from "@coral-xyz/anchor";
import { Program }  from "@coral-xyz/anchor";
import { SavingsVault } from "../target/types/savings_vault";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("savings-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program   = anchor.workspace.SavingsVault as Program<SavingsVault>;
  const owner     = provider.wallet as anchor.Wallet;

  let mint:       anchor.web3.PublicKey;
  let ownerToken: anchor.web3.PublicKey;
  let vault:      anchor.web3.PublicKey;
  let vaultToken: anchor.web3.PublicKey;

  const USDC_DECIMALS = 6;
  const toUsdc = (n: number) => n * 10 ** USDC_DECIMALS;

  before(async () => {
    // Create a mock USDC mint
    mint = await createMint(
      provider.connection,
      owner.payer,
      owner.publicKey,
      null,
      USDC_DECIMALS
    );

    // Create owner's token account and mint 1000 USDC
    ownerToken = await createAssociatedTokenAccount(
      provider.connection,
      owner.payer,
      mint,
      owner.publicKey
    );

    await mintTo(
      provider.connection,
      owner.payer,
      mint,
      ownerToken,
      owner.payer,
      toUsdc(1_000)
    );

    // Derive PDA addresses
    [vault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer()],
      program.programId
    );

    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    vaultToken = getAssociatedTokenAddressSync(mint, vault, true);
  });

  it("locks USDC with a future unlock timestamp", async () => {
    const amount    = toUsdc(100);
    const unlockAt  = Math.floor(Date.now() / 1_000) + 86_400; // 24 hours from now
    const label     = "Emergency fund";

    await program.methods
      .lockSavings(new anchor.BN(amount), new anchor.BN(unlockAt), label)
      .accounts({
        vault,
        vaultToken,
        ownerToken,
        mint,
        owner: owner.publicKey,
      })
      .rpc();

    const vaultAccount = await program.account.savingsVaultState.fetch(vault);
    assert.equal(vaultAccount.amount.toNumber(), amount, "stored amount must match");
    assert.equal(vaultAccount.unlockTimestamp.toNumber(), unlockAt, "unlock timestamp must match");
    assert.equal(vaultAccount.label, label, "label must match");
    assert.ok(vaultAccount.owner.equals(owner.publicKey), "owner must match");
    assert.ok(vaultAccount.mint.equals(mint), "mint must match");

    // Verify the USDC moved into the vault
    const vaultTokenAccount = await getAccount(provider.connection, vaultToken);
    assert.equal(vaultTokenAccount.amount.toString(), amount.toString(), "vault must hold USDC");
  });

  it("rejects unlock before the timestamp", async () => {
    try {
      await program.methods
        .unlockSavings()
        .accounts({
          vault,
          vaultToken,
          ownerToken,
          owner: owner.publicKey,
        })
        .rpc();

      assert.fail("Expected unlock to fail — vault is still locked");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      assert.include(msg, "StillLocked", "Error should reference StillLocked");
    }
  });

  it("rejects zero amount", async () => {
    const unlockAt = Math.floor(Date.now() / 1_000) + 3_600;
    const tempOwner = anchor.web3.Keypair.generate();

    // Airdrop SOL for fees
    const sig = await provider.connection.requestAirdrop(
      tempOwner.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const tempToken = await createAssociatedTokenAccount(
      provider.connection,
      owner.payer,
      mint,
      tempOwner.publicKey
    );
    await mintTo(provider.connection, owner.payer, mint, tempToken, owner.payer, toUsdc(10));

    const [tempVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), tempOwner.publicKey.toBuffer()],
      program.programId
    );

    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const tempVaultToken = getAssociatedTokenAddressSync(mint, tempVault, true);

    try {
      await program.methods
        .lockSavings(new anchor.BN(0), new anchor.BN(unlockAt), "zero")
        .accounts({
          vault: tempVault,
          vaultToken: tempVaultToken,
          ownerToken: tempToken,
          mint,
          owner: tempOwner.publicKey,
        })
        .signers([tempOwner])
        .rpc();

      assert.fail("Expected zero amount to fail");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      assert.include(msg, "ZeroAmount", "Error should reference ZeroAmount");
    }
  });

  it("rejects unlock timestamp in the past", async () => {
    const tempOwner = anchor.web3.Keypair.generate();

    const sig = await provider.connection.requestAirdrop(
      tempOwner.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const tempToken = await createAssociatedTokenAccount(
      provider.connection,
      owner.payer,
      mint,
      tempOwner.publicKey
    );
    await mintTo(provider.connection, owner.payer, mint, tempToken, owner.payer, toUsdc(10));

    const [tempVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), tempOwner.publicKey.toBuffer()],
      program.programId
    );

    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const tempVaultToken = getAssociatedTokenAddressSync(mint, tempVault, true);

    const pastTimestamp = Math.floor(Date.now() / 1_000) - 3_600; // 1 hour ago

    try {
      await program.methods
        .lockSavings(new anchor.BN(toUsdc(5)), new anchor.BN(pastTimestamp), "past")
        .accounts({
          vault: tempVault,
          vaultToken: tempVaultToken,
          ownerToken: tempToken,
          mint,
          owner: tempOwner.publicKey,
        })
        .signers([tempOwner])
        .rpc();

      assert.fail("Expected past timestamp to fail");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      assert.include(msg, "UnlockInPast", "Error should reference UnlockInPast");
    }
  });

  it("rejects label longer than 64 characters", async () => {
    const tempOwner = anchor.web3.Keypair.generate();

    const sig = await provider.connection.requestAirdrop(
      tempOwner.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const tempToken = await createAssociatedTokenAccount(
      provider.connection,
      owner.payer,
      mint,
      tempOwner.publicKey
    );
    await mintTo(provider.connection, owner.payer, mint, tempToken, owner.payer, toUsdc(10));

    const [tempVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), tempOwner.publicKey.toBuffer()],
      program.programId
    );

    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const tempVaultToken = getAssociatedTokenAddressSync(mint, tempVault, true);

    const longLabel = "a".repeat(65);
    const futureTimestamp = Math.floor(Date.now() / 1_000) + 3_600;

    try {
      await program.methods
        .lockSavings(new anchor.BN(toUsdc(5)), new anchor.BN(futureTimestamp), longLabel)
        .accounts({
          vault: tempVault,
          vaultToken: tempVaultToken,
          ownerToken: tempToken,
          mint,
          owner: tempOwner.publicKey,
        })
        .signers([tempOwner])
        .rpc();

      assert.fail("Expected long label to fail");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      assert.include(msg, "LabelTooLong", "Error should reference LabelTooLong");
    }
  });
});
