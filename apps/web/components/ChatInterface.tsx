"use client";

declare global {
  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
  }
  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }
}

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle, type ChangeEvent } from "react";
import { usePaymentStore } from "@/store/usePaymentStore";
import {
  createPaymentRecord,
  generateReceiptHash,
  isQuoteExpired,
  type PaymentRecord,
} from "@/lib/payment-state";
// AURON_FX_RATE replaced by live rate from useLiveRate()
import PaymentStatusTracker from "./PaymentStatusTracker";
import PaymentReceipt from "./PaymentReceipt";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { Send, Mic, MicOff, Sparkles, Lock, FileText, ShieldCheck, QrCode, ArrowRight, Link2, MessageSquare } from "lucide-react";
import QRScanner, { type ParsedQRResult } from "./QRScanner";
import QRAmountEntry from "./QRAmountEntry";
import { shortAddr, NETWORK } from "@/lib/solana";
import { runPreflightChecks } from "@/lib/preflight";
import { useLiveRate } from "@/lib/useLiveRate";
import { useStore, ChatMessage } from "@/store/useStore";
import type { ParsedAction } from "@/lib/claude";
import type { SecurityFlag } from "@/lib/security";
import { cn, formatTimestamp } from "@/lib/utils";
import ConfirmCard from "./ConfirmCard";
import RevealCard from "./RevealCard";
import {
  buildTransferSOL,
  buildTransferUSDC,
  buildUPIPayment,
  buildAgreementStamp,
  buildOwnershipStamp,
  buildSavingsLockPreview as buildSavingsLock,
  sha256,
  type BuildResult,
} from "@/lib/contracts";
import { notifyTxSuccess, notifyTxFailed } from "@/lib/notifications";
import { usePhantomDeepLink, type MobilePaymentContext } from "@/hooks/usePhantomDeepLink";
import { assessRisk } from "@/lib/risk";
import { chooseProvider, detectRegion } from "@/lib/routing";
import { resolveRecipient } from "@/lib/resolve-recipient";

export interface ChatInterfaceHandle {
  openQRScanner: () => void;
  submitMessage: (text: string) => void;
}

const SUGGESTIONS = [
  { icon: Send,        text: "Send ₹500 to Priya",              color: "#7c3aed" },
  { icon: Lock,        text: "Lock ₹2000 for 3 months",         color: "#10b981" },
  { icon: MessageSquare, text: "How much did I spend this month?", color: "#06b6d4" },
  { icon: Link2,       text: "Create a pay link for ₹500",      color: "#6366f1" },
  { icon: FileText,    text: "Arjun owes me ₹1500 — save it",   color: "#3b82f6" },
  { icon: ShieldCheck, text: "Prove I own this photo",           color: "#f59e0b" },
];

// Actions that don't need a ConfirmCard — they're informational or generate a link
const INFORMATIONAL_ACTIONS = new Set(["spending_query", "balance_query", "generate_pay_link"]);

const ChatInterface = forwardRef<ChatInterfaceHandle, object>(function ChatInterface(_, ref) {
  const { publicKey, connected: walletConnected, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  // ── Phantom Mobile Deep Link session ────────────────────────────────────
  const deepLink = usePhantomDeepLink();

  // Merge desktop (wallet adapter) + mobile (deep link) connection state
  const isConnected = walletConnected || deepLink.isConnected;
  const address     = publicKey?.toString() ?? deepLink.publicKey ?? null;

  function openConnect() {
    // On mobile Chrome (not inside Phantom browser) → deep link connect
    if (deepLink.isMobileDevice && !deepLink.isInPhantomBrowser) {
      deepLink.connect();
    } else {
      setVisible(true);
    }
  }

  // Live FX rate — refreshes every 60s, falls back to ₹83.15
  const { auronRate } = useLiveRate();

  const { messages, addMessage, pendingTx, setPendingTx, isLoading, setLoading, prefs, dailySpent, dailySpentINR, addDailySpent, addDailySpentINR, addCompletedTx, completedTxs } = useStore();

  const [input, setInput] = useState("");
  const [isListening, setListening] = useState(false);
  const [completedTx, setCompletedTx] = useState<{ txHash: string; confirmText: string } | null>(null);
  const [isExecuting, setExecuting] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);

  // ── QR merchant context — set when static QR (no amount) is scanned ─────────
  const [qrMerchantContext, setQrMerchantContext] = useState<{
    merchantName: string;
    upiId: string;
  } | null>(null);

  // ── Payment pipeline state ─────────────────────────────────────────────────
  const [activePayment, setActivePayment] = useState<PaymentRecord | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const paymentStore = usePaymentStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamTextRef = useRef("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Resume after Phantom mobile signing redirect ──────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Sync deep-link session (Phantom just redirected back)
    deepLink.refreshSession();

    // Check if Phantom returned an error
    const phantomErr = deepLink.consumePhantomError();
    if (phantomErr) {
      const msg =
        phantomErr.action === "sign"
          ? `❌ Transaction rejected in Phantom: ${phantomErr.errorMessage ?? "User cancelled."}`
          : `❌ Wallet connection rejected: ${phantomErr.errorMessage ?? "User cancelled."}`;
      addMessage({ role: "assistant", content: msg });
      return;
    }

    // Check if Phantom just completed a signature
    const result = deepLink.consumeCompletedSignature();
    if (!result) return;

    const { completed, paymentContext } = result;
    const { signature } = completed;

    if (!paymentContext || paymentContext.actionType !== "upi_payment") {
      // Generic non-UPI signing (transfer, etc.) — just surface the signature
      addMessage({
        role: "assistant",
        content: `✅ Transaction signed on-chain. Signature: \`${signature.slice(0, 12)}…\``,
      });
      return;
    }

    // ── Resume UPI payment post-signature flow ────────────────────────────
    void resumeUPIAfterMobileSign(signature, paymentContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount — deps are stable refs/callbacks

  function toggleVoice() {
    if (!("webkitSpeechRecognition" in globalThis || "SpeechRecognition" in globalThis)) {
      addMessage({ role: "system", content: "Voice input isn't supported in this browser. Try Chrome." });
      return;
    }
    if (isListening) { recognitionRef.current?.stop(); setListening(false); return; }
    const g = globalThis as typeof globalThis & { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition };
    const SR = g.SpeechRecognition ?? g.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR() as SpeechRecognition;
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (e) => { setInput(e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }

  function handleInputChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  const handleSubmit = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;
    if (!isConnected) { openConnect(); return; }

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    addMessage({ role: "user", content: msg });
    setLoading(true);
    streamTextRef.current = "";
    setStreamingContent("");

    try {
      // Build conversation history from last 8 user/assistant exchanges
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-8)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          userId: address,
          history,
          spendCeiling: prefs.spendCeiling,
          dailyCap: prefs.dailyCap,
          dailySpent,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        addMessage({ role: "assistant", content: (data as { error?: string }).error ?? "Something went wrong." });
        return;
      }

      // ── Read SSE stream ────────────────────────────────────────────────
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const jsonStr = part.slice(6).trim();
          if (!jsonStr) continue;

          let event: Record<string, unknown>;
          try { event = JSON.parse(jsonStr); } catch { continue; }

          if (event.type === "text") {
            streamTextRef.current += String(event.chunk ?? "");
            setStreamingContent(streamTextRef.current);

          } else if (event.type === "done") {
            setStreamingContent("");
            streamTextRef.current = "";
            if (event.displayText) {
              addMessage({ role: "assistant", content: event.displayText as string });
            }
            const action = event.action as ParsedAction | null;

            // ── Spending query: call /api/spending and display answer ───────
            if (action?.action === "spending_query" && address) {
              try {
                const sq = await fetch("/api/spending", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    question: msg,
                    period:   action.query_period ?? "month",
                    userId:   address,
                  }),
                });
                if (sq.ok) {
                  const sqData = await sq.json() as { answer?: string };
                  if (sqData.answer) {
                    addMessage({ role: "assistant", content: sqData.answer });
                  }
                }
              } catch { /* ignore — displayText already shown */ }
              continue;
            }

            // ── Generate pay link: build URL and add to chat ────────────────
            if (action?.action === "generate_pay_link" && address) {
              const inr  = action.inr_amount ?? action.amount ?? 0;
              const note = action.pay_link_note ?? action.note ?? "";
              const base = typeof window !== "undefined" ? window.location.origin : "https://auron-mocha.vercel.app";
              let url = `${base}/pay/${address}`;
              if (inr)  url += `?amount=${inr}&currency=INR`;
              if (note) url += `${inr ? "&" : "?"}note=${encodeURIComponent(note)}`;
              addMessage({
                role: "assistant",
                content: `🔗 Your pay link is ready!\n\n${url}\n\nShare it on WhatsApp, Instagram, X — anyone can pay you ${inr ? `₹${inr.toLocaleString("en-IN")}` : "any amount"} without downloading an app.`,
              });
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(url).catch(() => {});
              }
              continue;
            }

            // ── Balance / informational — displayText already set above ──────
            if (action?.action && INFORMATIONAL_ACTIONS.has(action.action)) continue;

            if (action?.action && (typeof action.confidence === "number" ? action.confidence : 0) >= 0.8) {

              // ── Recipient resolution (.sol domain / phone number) ──────────
              // Resolve before showing the ConfirmCard so the user sees
              // "Send ₹500 to priya.sol" with a verified address underneath.
              const isTransfer = ["transfer", "transfer_sol", "transfer_usdc"].includes(action.action ?? "");
              let resolvedAction = action;
              let resolvedConfirmText = String(event.confirmText ?? "");

              if (isTransfer && action.recipient) {
                try {
                  const resolved = await resolveRecipient(action.recipient);

                  // Replace the raw recipient with the resolved wallet address
                  resolvedAction = { ...action, recipient: resolved.address };

                  // Update confirm text: show display name (e.g. "priya.sol")
                  // instead of a truncated wallet address
                  if (resolved.type !== "wallet") {
                    resolvedConfirmText = resolvedConfirmText.replace(
                      action.recipient,
                      resolved.display
                    );
                    // Append resolved address in small print for transparency
                    resolvedConfirmText += ` (${resolved.address.slice(0, 4)}…${resolved.address.slice(-4)})`;
                  }
                } catch (resolveErr: unknown) {
                  // Resolution failed — show the error instead of the ConfirmCard
                  const errMsg = resolveErr instanceof Error ? resolveErr.message : "Could not resolve recipient.";
                  addMessage({ role: "assistant", content: `❌ ${errMsg}` });
                  setLoading(false);
                  return;
                }
              }

              setPendingTx({
                action: resolvedAction,
                confirmText: resolvedConfirmText,
                securityFlags: (event.securityFlags as SecurityFlag[]) ?? [],
                requiresSlowdown: Boolean(event.requiresSlowdown),
              });
            }

          } else if (event.type === "daily_cap_exceeded") {
            setStreamingContent("");
            streamTextRef.current = "";
            addMessage({
              role: "assistant",
              content: `⛔ This would exceed your daily limit of ₹${(event.limit as number)?.toLocaleString("en-IN")}. You've spent ₹${(event.spent as number)?.toLocaleString("en-IN")} today.`,
            });

          } else if (event.type === "error") {
            setStreamingContent("");
            streamTextRef.current = "";
            addMessage({ role: "assistant", content: String(event.message ?? "Something went wrong.") });
          }
        }
      }
    } catch {
      addMessage({ role: "assistant", content: "Network error. Check your connection and try again." });
    } finally {
      setStreamingContent("");
      streamTextRef.current = "";
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, isConnected, address, messages, prefs, dailySpent, addMessage, setLoading, setPendingTx]);

  // ── Build Solana transaction from parsed action ────────────────────────
  async function buildTxResult(action: ParsedAction, confirmText: string): Promise<BuildResult> {
    if (!address) throw new Error("Wallet not connected");

    switch (action.action) {
      case "transfer_sol":
        return buildTransferSOL(address, action.recipient ?? "", action.amount ?? 0);

      case "transfer":
      case "transfer_usdc":
        return buildTransferUSDC(address, action.recipient ?? "", action.amount_usdc ?? action.amount ?? 0);

      case "upi_payment":
        return buildUPIPayment(
          address,
          action.amount_usdc ?? 0,
          action.upi_id ?? "",
          action.merchant_name ?? action.upi_id ?? "",
          action.inr_amount ?? 0
        );

      case "stamp_agreement": {
        const hash = await sha256(action.description ?? confirmText);
        return buildAgreementStamp(
          address,
          action.description ?? "",
          action.recipient ?? "",
          action.amount ?? null,
          hash
        );
      }

      case "lock_savings":
        return buildSavingsLock(
          address,
          action.amount_usdc ?? action.amount ?? 0,
          action.duration_days ?? 30,
          action.label ?? action.description ?? "Savings"
        );

      case "stamp_ownership":
        return buildOwnershipStamp(
          address,
          action.file_hash ?? "",
          action.file_name ?? "file",
          action.description ?? ""
        );

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  // ── Post-signature resume (mobile deep-link path) ─────────────────────────
  // Called on mount when Phantom redirected back with a completed signature.
  async function resumeUPIAfterMobileSign(
    signature: string,
    ctx: MobilePaymentContext
  ) {
    setExecuting(true);

    // Reconstruct a minimal PaymentRecord with the original IDs
    const now = Date.now();
    const resumedRecord: PaymentRecord = {
      paymentId:          ctx.paymentId,
      idempotencyKey:     ctx.idempotencyKey,
      inrAmount:          ctx.inrAmount,
      usdcAmount:         ctx.usdcAmount,
      fxRate:             ctx.fxRate,
      quoteExpiresAt:     now + 60_000,   // already signed — expiry irrelevant
      quote:              null,
      risk:               null,
      route:              null,
      merchantUpiId:      ctx.upiId,
      merchantName:       ctx.merchantName,
      solanaSignature:    signature,
      solanaBlockTime:    null,
      fromAddress:        ctx.fromAddress,
      toAddress:          ctx.toAddress,
      onmetaPayoutId:     null,
      utrNumber:          null,
      verifiedTx:         false,
      demoMode:           false,
      receiptHash:        null,
      status:             "tx_pending",
      events: [{
        timestamp: now,
        status:    "tx_pending",
        message:   `Resumed after Phantom mobile signing. Tx: ${signature.slice(0, 8)}…`,
      }],
      initiatedAt:        now,
      confirmedAt:        null,
      completedAt:        null,
      failureCategory:    null,
      failureReason:      null,
      retryCount:         0,
      refundTxSignature:  null,
    };

    paymentStore.addPayment(resumedRecord);
    paymentStore.setActivePayment(ctx.paymentId);
    setActivePayment(resumedRecord);

    // Helper: update both store + local state
    function updateRecord(updater: (r: PaymentRecord) => PaymentRecord) {
      paymentStore.updatePayment(ctx.paymentId, updater);
      setActivePayment((prev) => (prev ? updater(prev) : prev));
    }
    function transition(
      newStatus: PaymentRecord["status"],
      message: string,
      data?: Record<string, unknown>
    ) {
      const t = Date.now();
      updateRecord((r) => ({
        ...r,
        status: newStatus,
        events: [...r.events, { timestamp: t, status: newStatus, message, data }],
        confirmedAt: newStatus === "tx_confirmed" ? t : r.confirmedAt,
        completedAt: newStatus === "completed"    ? t : r.completedAt,
      }));
    }

    try {
      // ── Wait for on-chain confirmation ──────────────────────────────────
      transition("tx_pending", `Confirming tx: ${signature.slice(0, 8)}…`, { signature });
      try {
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");
      } catch {
        // confirmTransaction timed out — tx may still be propagating on devnet.
        // Poll up to 5 times (15 seconds total) before giving up.
        let landed = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, 3_000));
          const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
          landed =
            status.value?.confirmationStatus === "confirmed" ||
            status.value?.confirmationStatus === "finalized";
          if (landed) break;
        }
        if (!landed) {
          transition("failed", "Confirmation timeout — Solana may be congested.");
          updateRecord((r) => ({
            ...r,
            failureCategory: "tx_timeout",
            failureReason:   "Transaction not confirmed in time. Your USDC was NOT deducted.",
          }));
          addMessage({ role: "assistant", content: "⚠️ Tx timed out. Your USDC was not deducted. Please try again." });
          setExecuting(false);
          return;
        }
      }

      const confirmedAt = Date.now();
      transition("tx_confirmed", "USDC confirmed on Solana", { signature });
      updateRecord((r) => ({ ...r, solanaBlockTime: confirmedAt, confirmedAt }));
      addDailySpent(ctx.usdcAmount);
      addCompletedTx({
        id:          ctx.paymentId,
        action:      {
          action: "upi_payment", upi_id: ctx.upiId,
          amount_usdc: ctx.usdcAmount, inr_amount: ctx.inrAmount,
          amount: null, recipient: null, merchant_name: ctx.merchantName,
          note: null, duration_days: null, file_hash: null, file_name: null,
          description: null, label: null, vault_id: null,
          confidence: 1, ambiguity: null,
        } as import("@/lib/claude").ParsedAction,
        txHash:      signature,
        timestamp:   confirmedAt,
        confirmText: ctx.confirmText,
      });

      // ── Call OnMeta offramp ─────────────────────────────────────────────
      transition("offramp_initiated", "Initiating UPI payout via OnMeta");
      let payoutResult: {
        payoutId?: string; utrNumber?: string; error?: string;
        retryable?: boolean; failureCategory?: string; retryCount?: number;
      } | null = null;

      try {
        transition("offramp_processing", "OnMeta processing INR payout…");
        const res = await fetch("/api/offramp", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId:      ctx.paymentId,
            idempotencyKey: ctx.idempotencyKey,
            usdcAmount:     ctx.usdcAmount,
            merchantUpiId:  ctx.upiId,
            merchantName:   ctx.merchantName,
            inrAmount:      ctx.inrAmount,
            txSignature:    signature,
            userId:         ctx.fromAddress,
          }),
        });
        payoutResult = await res.json();
        if (!res.ok || payoutResult?.error) throw new Error(payoutResult?.error ?? "Payout failed");

        const completedAt = Date.now();
        const receiptHash = await generateReceiptHash({
          ...resumedRecord,
          solanaSignature: signature,
          onmetaPayoutId: payoutResult?.payoutId ?? null,
          utrNumber:      payoutResult?.utrNumber ?? null,
          confirmedAt,
          completedAt,
        });

        transition("completed", `₹${ctx.inrAmount.toLocaleString("en-IN")} delivered to ${ctx.upiId}`);
        updateRecord((r) => ({
          ...r,
          status:         "completed",
          onmetaPayoutId: payoutResult?.payoutId ?? null,
          utrNumber:      payoutResult?.utrNumber ?? null,
          receiptHash,
          completedAt,
        }));

        const utr = payoutResult?.utrNumber ? ` · UTR ${payoutResult.utrNumber}` : "";
        addMessage({
          role:    "assistant",
          content: `✅ ₹${ctx.inrAmount.toLocaleString("en-IN")} sent to ${ctx.merchantName} via UPI${utr}. Tap the tracker to view receipt.`,
        });
        notifyTxSuccess("upi_payment", ctx.confirmText).catch(() => {});

      } catch (offrampErr: unknown) {
        const errMsg = offrampErr instanceof Error ? offrampErr.message : "Payout failed";
        transition("failed", `UPI payout failed: ${errMsg}`);
        updateRecord((r) => ({
          ...r,
          failureCategory: (payoutResult?.failureCategory ?? "offramp_rejected") as PaymentRecord["failureCategory"],
          failureReason:   `Merchant payment failed: ${errMsg}. Your USDC was received by Auron. Contact support.`,
          retryCount:      payoutResult?.retryCount ?? 0,
        }));
        addMessage({
          role:    "assistant",
          content: `⚠️ USDC confirmed on-chain but UPI payout failed: ${errMsg}. Tap the tracker to request a refund.`,
        });
        notifyTxFailed("upi_payment", errMsg).catch(() => {});
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      transition("failed", errMsg);
      updateRecord((r) => ({ ...r, failureCategory: "unknown", failureReason: errMsg }));
      addMessage({ role: "assistant", content: `❌ Payment error: ${errMsg}` });
    } finally {
      setExecuting(false);
    }
  }

  async function handleConfirm() {
    if (!pendingTx || !address) return;
    const { action, confirmText } = pendingTx;

    // ── UPI payment: use full state-machine pipeline ────────────────────────
    if (action.action === "upi_payment") {
      await handleUPIPayment(action, confirmText);
      return;
    }

    // ── All other actions ────────────────────────────────────────────────────
    setExecuting(true);
    try {
      const result = await buildTxResult(action, confirmText);

      // Mobile: use deep link for signing
      if (deepLink.isMobileDevice && !deepLink.isInPhantomBrowser && deepLink.isConnected) {
        deepLink.signAndSend(
          result.transaction,
          { confirmText, actionType: action.action ?? "unknown", returnPath: "/app" },
        );
        setExecuting(false);
        return; // page will redirect
      }

      const signature = await sendTransaction(result.transaction, connection);
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");

      const isTransfer = ["transfer", "transfer_sol", "transfer_usdc"].includes(action.action ?? "");
      const spentAmount = action.amount_usdc ?? action.amount;
      if (isTransfer && spentAmount) addDailySpent(spentAmount);

      const completed = { id: crypto.randomUUID(), action, txHash: signature, timestamp: Date.now(), confirmText };
      addCompletedTx(completed);
      setCompletedTx({ txHash: signature, confirmText });
      setPendingTx(null);
      notifyTxSuccess(action.action ?? "transaction", confirmText).catch(() => {});
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      addMessage({ role: "assistant", content: `❌ Transaction failed: ${errMsg}. Please try again.` });
      notifyTxFailed(action.action ?? "transaction", errMsg).catch(() => {});
      setPendingTx(null);
    } finally {
      setExecuting(false);
    }
  }

  // ── Full UPI payment pipeline with state machine ─────────────────────────
  async function handleUPIPayment(action: NonNullable<typeof pendingTx>["action"], confirmText: string) {
    if (!address) return;
    // Mobile deep-link: wallet adapter publicKey may be null — that's OK
    setExecuting(true);

    // ── Fetch authoritative quote from server ──────────────────────────────
    // Claude's parsed amount_usdc is ONLY used as fallback.
    // The real USDC amount is always computed server-side with the live rate + spread.
    const inrAmount = action.inr_amount ?? 0;
    const merchantUpiId = action.upi_id ?? "";
    const merchantName = action.merchant_name ?? merchantUpiId.split("@")[0] ?? "merchant";

    let usdcAmount = action.amount_usdc ?? inrAmount / auronRate;
    let quoteMeta: import("@/lib/payment-state").QuoteMetadata | null = null;
    let quoteFxRate = auronRate;

    try {
      const quoteRes = await fetch("/api/quote", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inrAmount, merchantUpiId, merchantName }),
      });
      if (quoteRes.ok) {
        const q = await quoteRes.json() as {
          quoteId: string; usdcAmount: number; marketRate: number;
          auronRate: number; spreadPercent: number; expiresAt: number; createdAt: number;
        };
        usdcAmount  = q.usdcAmount;
        quoteFxRate = q.auronRate;
        quoteMeta   = {
          quoteId:       q.quoteId,
          marketRate:    q.marketRate,
          auronRate:     q.auronRate,
          spreadPercent: q.spreadPercent,
          expiresAt:     q.expiresAt,
          createdAt:     q.createdAt,
        };
      }
    } catch {
      console.warn("[quote] Server quote failed — using live rate fallback");
    }

    // Create payment record
    const record = createPaymentRecord({
      inrAmount,
      usdcAmount,
      fxRate: quoteFxRate,
      merchantUpiId,
      merchantName,
      fromAddress: address,
      toAddress: process.env.NEXT_PUBLIC_FEE_WALLET ?? "",
    });

    // Attach quote metadata immediately
    if (quoteMeta) {
      record.quote = quoteMeta;
      record.quoteExpiresAt = quoteMeta.expiresAt;
    }

    paymentStore.addPayment(record);
    paymentStore.setActivePayment(record.paymentId);
    setActivePayment(record);
    setPendingTx(null);

    // ── Helper: update both store and local state ─────────────────────────
    function updateRecord(updater: (r: PaymentRecord) => PaymentRecord) {
      paymentStore.updatePayment(record.paymentId, updater);
      setActivePayment((prev) => prev ? updater(prev) : prev);
    }

    function transition(
      newStatus: PaymentRecord["status"],
      message: string,
      data?: Record<string, unknown>
    ) {
      const now = Date.now();
      updateRecord((r) => ({
        ...r,
        status: newStatus,
        events: [...r.events, { timestamp: now, status: newStatus, message, data }],
        confirmedAt: newStatus === "tx_confirmed" ? now : r.confirmedAt,
        completedAt: newStatus === "completed" ? now : r.completedAt,
      }));
    }

    try {
      // ── Step 1: Check quote expiry ──────────────────────────────────────
      if (isQuoteExpired(record)) {
        transition("failed", "FX quote expired — rate may have changed. Please retry.");
        updateRecord((r) => ({ ...r, failureCategory: "rate_expired", failureReason: "FX quote expired before payment was confirmed. Please try again for a fresh rate." }));
        setExecuting(false);
        return;
      }

      // ── Step 1.5: Risk assessment ───────────────────────────────────────────
      transition("risk_check", "Running security check…");
      const riskNow = Date.now();
      const oneHourAgo = riskNow - 3_600_000;
      const recentTxCount  = completedTxs.filter((tx) => tx.timestamp > oneHourAgo).length;
      const isNewRecipient = !completedTxs.some((tx) => tx.action.upi_id === merchantUpiId);

      const risk = assessRisk({
        userId:          address,
        recipientId:     merchantUpiId,
        amountUSDC:      usdcAmount,
        amountINR:       inrAmount,
        dailySpentUSDC:  dailySpent,
        dailySpentINR:   dailySpentINR,
        recentTxCount,
        isNewRecipient,
      });

      // Attach risk metadata to record
      updateRecord((r) => ({
        ...r,
        risk: {
          score:            risk.score,
          flags:            risk.flags ?? [],
          blocked:          risk.blocked,
          requiresSlowdown: risk.requiresSlowdown,
          assessedAt:       riskNow,
        },
      }));

      if (risk.blocked) {
        transition("failed", risk.reason ?? "Transaction blocked by risk engine");
        updateRecord((r) => ({
          ...r,
          failureCategory: "unknown",
          failureReason: risk.reason,
        }));
        addMessage({ role: "assistant", content: `🛡️ ${risk.reason}` });
        setExecuting(false);
        return;
      }

      // ── Step 1.6: Pre-flight checks (balance + network + SOL fee) ──────────
      transition("building_tx", "Checking wallet balance…");
      try {
        const walletNetwork = (window as unknown as { solana?: { networkVersion?: string; network?: string } })
          .solana?.networkVersion ?? "";
        const preflight = await runPreflightChecks(address, usdcAmount, walletNetwork);

        if (!preflight.ok) {
          transition("failed", preflight.message);
          updateRecord((r) => ({
            ...r,
            failureCategory: preflight.status === "insufficient_usdc" ? "insufficient_usdc"
              : preflight.status === "network_mismatch" ? "network_mismatch"
              : "insufficient_sol",
            failureReason: preflight.message,
          }));
          addMessage({ role: "assistant", content: `❌ ${preflight.message}` });
          setExecuting(false);
          return;
        }
      } catch {
        console.warn("[preflight] check failed — proceeding anyway");
      }

      // ── Step 2: Build Solana tx ─────────────────────────────────────────
      // IMPORTANT: override action.amount_usdc with the live-quoted usdcAmount.
      // Claude's parsed amount_usdc uses an internal estimate rate; the quote
      // API returns the authoritative amount at the live rate + spread.
      // The transaction on-chain must match what /api/v1/pay sends for verification.
      transition("building_tx", "Building Solana transaction…");
      const txResult = await buildTxResult(
        { ...action, amount_usdc: usdcAmount },
        confirmText
      );

      // ── Step 3: Await user signature ────────────────────────────────────
      transition("awaiting_signature", "Waiting for Phantom signature");
      let signature: string;

      // Mobile deep-link path: redirect to Phantom, resume after redirect-back
      if (deepLink.isMobileDevice && !deepLink.isInPhantomBrowser && deepLink.isConnected) {
        const toAddress = process.env.NEXT_PUBLIC_FEE_WALLET ?? "";
        const paymentContext: MobilePaymentContext = {
          paymentId:      record.paymentId,
          idempotencyKey: record.idempotencyKey,
          usdcAmount,
          inrAmount,
          upiId:          action.upi_id ?? "",
          merchantName:   action.merchant_name ?? action.upi_id?.split("@")[0] ?? "merchant",
          fromAddress:    address,
          toAddress,
          fxRate:         auronRate,
          confirmText,
          actionType:     "upi_payment",
        };
        const redirected = deepLink.signAndSend(
          txResult.transaction,
          { paymentId: record.paymentId, confirmText, actionType: "upi_payment", returnPath: "/app" },
          paymentContext
        );
        if (!redirected) {
          transition("failed", "Phantom session expired. Please reconnect wallet.");
          updateRecord((r) => ({
            ...r,
            failureCategory: "tx_rejected_by_user",
            failureReason:   "Phantom session expired. Reconnect and try again.",
          }));
          addMessage({ role: "assistant", content: "❌ Phantom session expired. Tap Connect Wallet and try again." });
          setExecuting(false);
        }
        // Page will redirect — execution stops here
        return;
      }

      // Desktop / Phantom-browser path: use wallet adapter
      try {
        signature = await sendTransaction(txResult.transaction, connection);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Signature rejected";
        const cancelled = msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("cancelled");
        transition("failed", cancelled ? "Payment cancelled by user." : `Signature failed: ${msg}`);
        updateRecord((r) => ({
          ...r,
          failureCategory: cancelled ? "tx_rejected_by_user" : "tx_simulation_failed",
          failureReason: cancelled ? "You cancelled the payment in Phantom." : msg,
        }));
        addMessage({ role: "assistant", content: cancelled ? "Payment cancelled." : `❌ ${msg}` });
        setExecuting(false);
        return;
      }

      // ── Step 4: Wait for on-chain confirmation ──────────────────────────
      transition("tx_pending", `Tx submitted: ${signature.slice(0, 8)}…`, { signature });
      updateRecord((r) => ({ ...r, solanaSignature: signature }));

      try {
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");
      } catch {
        // confirmTransaction timed out — tx may still be propagating on devnet.
        // Poll up to 5 times (15 seconds total) before giving up.
        let landed = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, 3_000));
          const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
          landed = status.value?.confirmationStatus === "confirmed" ||
                   status.value?.confirmationStatus === "finalized";
          if (landed) break;
        }
        if (!landed) {
          transition("failed", "Transaction confirmation timeout — Solana network may be congested.");
          updateRecord((r) => ({
            ...r,
            failureCategory: "tx_timeout",
            failureReason: "The Solana network did not confirm your transaction in time. Your USDC was NOT deducted.",
          }));
          addMessage({ role: "assistant", content: "⚠️ Transaction timed out. Your USDC was not deducted. Please try again." });
          setExecuting(false);
          return;
        }
      }

      // ── Step 5: Record on-chain confirmation ────────────────────────────
      const now = Date.now();
      transition("tx_confirmed", "USDC confirmed on Solana", { signature });
      updateRecord((r) => ({ ...r, solanaSignature: signature, solanaBlockTime: now, confirmedAt: now }));

      addCompletedTx({ id: record.paymentId, action, txHash: signature, timestamp: now, confirmText });

      // ── Step 5b: Track daily spend (USDC + INR) ────────────────────────
      addDailySpent(usdcAmount);
      addDailySpentINR(inrAmount);

      // ── Step 6: Route + settle ──────────────────────────────────────────
      transition("routing", "Selecting best settlement route…");
      const region   = detectRegion("INR", merchantUpiId || undefined);
      const route    = chooseProvider(region, usdcAmount);
      const routeNow = Date.now();

      // Attach route metadata to record
      updateRecord((r) => ({
        ...r,
        route: {
          provider:         route.path,
          fallbackProvider: route.fallback ?? null,
          region,
          feePercent:       route.feePercent,
          estimatedSeconds: route.estimatedTimeSeconds,
          selectedAt:       routeNow,
        },
      }));

      transition("offramp_initiated", `Payout via ${route.path} · est. ${route.estimatedTimeLabel}`);

      try {
        transition("offramp_processing", `Processing ₹${inrAmount.toLocaleString("en-IN")} via ${route.path}…`);

        // ── Call /v1/pay — ledger-backed settlement endpoint ──────────────
        const payRes = await fetch("/api/v1/pay", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId:       record.paymentId,
            idempotencyKey:  record.idempotencyKey,
            merchantUpiId,
            merchantName,
            inrAmount,
            usdcAmount,
            txSignature:     signature,
            userId:          address,
            provider:        route.path,
            fallbackProvider: route.fallback,
            quoteFxRate:     quoteFxRate,
            riskScore:       record.risk?.score,
            riskFlags:       record.risk?.flags,
          }),
        });

        const payData = await payRes.json() as {
          success: boolean;
          payoutId?: string;
          utrNumber?: string;
          status?: string;
          error?: string;
          errorCode?: string;
          retryable?: boolean;
          failureCategory?: string;
          verifiedTx?: boolean;
          demoMode?: boolean;
        };

        if (!payRes.ok || !payData.success) {
          throw new Error(payData.error ?? "Payout failed");
        }

        // ── Poll /v1/payment/:id for final status (async settlement path) ─
        // The worker may still be processing — poll until completed or failed
        let finalUtr    = payData.utrNumber;
        let finalPayout = payData.payoutId;
        let pollStatus  = payData.status ?? "settling";

        if (pollStatus !== "completed" && pollStatus !== "failed") {
          const POLL_INTERVAL_MS = 2_000;
          const POLL_TIMEOUT_MS  = 30_000;
          const pollStart = Date.now();

          while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            try {
              const statusRes = await fetch(`/api/v1/payment/${record.paymentId}`);
              if (statusRes.ok) {
                const s = await statusRes.json() as {
                  status: string; settlement?: { utr?: string; payoutId?: string };
                };
                pollStatus  = s.status;
                finalUtr    = s.settlement?.utr    ?? finalUtr;
                finalPayout = s.settlement?.payoutId ?? finalPayout;
                if (pollStatus === "completed" || pollStatus === "failed") break;
              }
            } catch { /* network blip — keep polling */ }
          }
        }

        if (pollStatus === "failed") {
          throw new Error("Payout failed after settlement worker processing");
        }

        // ── Step 7: Mark complete + generate receipt ──────────────────────
        const completedNow = Date.now();
        const receiptHash = await generateReceiptHash({
          ...record,
          solanaSignature: signature,
          onmetaPayoutId: finalPayout ?? null,
          utrNumber: finalUtr ?? null,
          confirmedAt: now,
          completedAt: completedNow,
        });

        transition("completed", `₹${inrAmount.toLocaleString("en-IN")} delivered to ${merchantUpiId}`);
        updateRecord((r) => ({
          ...r,
          status:         "completed",
          onmetaPayoutId: finalPayout ?? null,
          utrNumber:      finalUtr    ?? null,
          verifiedTx:     payData.verifiedTx ?? false,
          demoMode:       payData.demoMode   ?? false,
          receiptHash,
          completedAt:    completedNow,
        }));

        const utr = finalUtr ? ` · UTR ${finalUtr}` : "";
        addMessage({
          role: "assistant",
          content: `✅ ₹${inrAmount.toLocaleString("en-IN")} sent to ${merchantName} via UPI${utr}. Tap the tracker to view receipt.`,
        });

        notifyTxSuccess("upi_payment", confirmText).catch(() => {});

      } catch (offrampErr: unknown) {
        const errMsg = offrampErr instanceof Error ? offrampErr.message : "Payout failed";

        transition("failed", `Payout failed: ${errMsg}`);
        updateRecord((r) => ({
          ...r,
          failureCategory: "offramp_rejected",
          failureReason: `Merchant payment failed: ${errMsg}. Your USDC has been received by Auron. Please contact support.`,
          retryCount: 0,
        }));

        addMessage({
          role: "assistant",
          content: `⚠️ USDC confirmed on-chain but payout failed: ${errMsg}. Funds are safe — tap the tracker to request a refund.`,
        });

        notifyTxFailed("upi_payment", errMsg).catch(() => {});
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      transition("failed", errMsg);
      updateRecord((r) => ({
        ...r,
        failureCategory: "unknown",
        failureReason: errMsg,
      }));
      addMessage({ role: "assistant", content: `❌ Payment error: ${errMsg}` });
    } finally {
      setExecuting(false);
    }
  }

  // ── Handle refund request from tracker ──────────────────────────────────
  async function handleRequestRefund() {
    if (!activePayment || !address) return;
    const p = activePayment;

    setActivePayment((prev) => prev ? { ...prev, status: "refund_pending" } : prev);
    paymentStore.transition(p.paymentId, "refund_pending", "Refund requested by user");

    try {
      const res = await fetch("/api/payment/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: p.paymentId,
          userId: address,
          recipientAddress: address,
          usdcAmount: p.usdcAmount,
          reason: p.failureReason ?? "Offramp failure",
        }),
      });

      const result = await res.json() as { success: boolean; txSignature?: string; message: string };

      if (result.success) {
        paymentStore.transition(p.paymentId, "refunded", result.message);
        setActivePayment((prev) => prev ? { ...prev, status: "refunded", refundTxSignature: result.txSignature ?? null } : prev);
        addMessage({ role: "assistant", content: `♻️ Refund processed: ${result.message}` });
      } else {
        addMessage({ role: "assistant", content: `⚠️ Refund request logged. Support will process it manually. Payment ID: ${p.paymentId.slice(0, 8)}` });
      }
    } catch {
      addMessage({ role: "assistant", content: `⚠️ Could not process refund automatically. Please contact support with payment ID: ${p.paymentId.slice(0, 8)}` });
    }
  }

  function handleCancel() {
    setPendingTx(null);
    addMessage({ role: "assistant", content: "Cancelled. What would you like to do?" });
  }

  // ── QR scan handler — two paths, Claude bypassed entirely ─────────────────
  function handleQRScan(parsed: ParsedQRResult) {
    setShowQRScanner(false);

    if (parsed.type === "upi") {
      const { pa, pn, am } = parsed.data;
      const merchantName = pn || pa.split("@")[0];

      if (am && am > 0) {
        // ── PATH 1: Dynamic QR — amount embedded → direct to ConfirmCard ──
        buildQRAction(merchantName, pa, am);
      } else {
        // ── PATH 2: Static QR — no amount → show amount entry modal ───────
        setQrMerchantContext({ merchantName, upiId: pa });
      }
      return;
    }

    // Solana Pay QR — still goes through chat (structured but token-type varies)
    const { recipient, label, amount, splToken } = parsed.data;
    const name  = label || shortAddr(recipient);
    const token = splToken ? "USDC" : "SOL";
    const msg   = amount
      ? `Send ${amount} ${token} to ${name} (${recipient})`
      : `Send ${token} to ${name} (${recipient}) — how much?`;
    setTimeout(() => handleSubmit(msg), 120);
  }

  // ── Build ParsedAction from QR data and set pendingTx (no Claude) ──────────
  function buildQRAction(merchantName: string, upiId: string, inrAmount: number) {
    const action: ParsedAction = {
      action:           "upi_payment",
      upi_id:           upiId,
      merchant_name:    merchantName,
      inr_amount:       inrAmount,
      amount_usdc:      null,   // server computes authoritative amount at quote time
      amount:           null,
      recipient:        null,
      split_recipients: null,
      split_total_inr:  null,
      query_period:     null,
      query_category:   null,
      pay_link_note:    null,
      note:             null,
      duration_days:    null,
      file_hash:        null,
      file_name:        null,
      description:      null,
      label:            null,
      vault_id:         null,
      confidence:       1.0,
      ambiguity:        null,
      detected_language: null,
    };

    const confirmText = `Pay ₹${inrAmount.toLocaleString("en-IN")} to ${merchantName} via UPI.`;

    // Surface in chat so there's a record
    addMessage({
      role:    "user",
      content: `📷 Pay ₹${inrAmount.toLocaleString("en-IN")} to ${merchantName} (${upiId})`,
    });

    setPendingTx({
      action,
      confirmText,
      securityFlags:    [],
      requiresSlowdown: false,
    });
  }

  // ── QR amount confirmed (static QR path) ────────────────────────────────────
  function handleQRAmountConfirm(inrAmount: number) {
    if (!qrMerchantContext) return;
    const { merchantName, upiId } = qrMerchantContext;
    setQrMerchantContext(null);
    buildQRAction(merchantName, upiId, inrAmount);
  }

  // Expose scanner + submit to parent (used by mobile Scan tab)
  useImperativeHandle(ref, () => ({
    openQRScanner: () => setShowQRScanner(true),
    submitMessage: (text: string) => handleSubmit(text),
  }));

  const isEmpty = messages.length === 0;

  // Network mismatch: wallet connected but on wrong Solana network
  const _showNetworkWarning = isConnected && NETWORK === "mainnet-beta" &&
    typeof window !== "undefined" &&
    // Detect if Phantom is likely on devnet (window.solana cluster hint)
    (window as unknown as Record<string, { isPhantom?: boolean }>).solana?.isPhantom === true;

  return (
    <div className="flex flex-col h-full">

      {/* ── Network warning banner ───────────────────────────────── */}
      {NETWORK === "mainnet-beta" && isConnected && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium shrink-0"
          style={{ background: "rgba(234,179,8,0.08)", borderBottom: "1px solid rgba(234,179,8,0.18)", color: "#ca8a04" }}
        >
          <span>⚡</span>
          <span>Mainnet — real USDC will be spent. Ensure Phantom is on <strong>Mainnet Beta</strong>.</span>
        </div>
      )}
      {NETWORK === "devnet" && isConnected && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium shrink-0"
          style={{ background: "rgba(59,130,246,0.08)", borderBottom: "1px solid rgba(59,130,246,0.15)", color: "#3b82f6" }}
        >
          <span>🔧</span>
          <span>Devnet — test mode, no real money. Switch Phantom to <strong>Devnet</strong>.</span>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">

        {/* Empty state */}
        <AnimatePresence>
          {isEmpty && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-5 py-4"
            >
              {/* ── QR HERO — flagship, dominant ─────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.button
                  onClick={() => setShowQRScanner(true)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="relative w-full rounded-2xl overflow-hidden text-left group"
                  style={{
                    background: "linear-gradient(135deg, rgba(201,168,76,0.09) 0%, rgba(201,168,76,0.04) 100%)",
                    border: "1px solid rgba(201,168,76,0.22)",
                    padding: "22px 22px 18px",
                  }}
                >
                  {/* Animated scan-line sweep across the card */}
                  <motion.div
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "linear", repeatDelay: 1.4 }}
                    className="absolute inset-y-0 w-16 pointer-events-none"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.08), transparent)",
                    }}
                  />

                  {/* Hover glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                    style={{ background: "radial-gradient(ellipse 80% 80% at 30% 50%, rgba(201,168,76,0.08) 0%, transparent 65%)" }} />

                  <div className="relative flex items-center gap-5">
                    {/* QR Icon block */}
                    <div className="relative shrink-0">
                      <div className="w-[68px] h-[68px] rounded-2xl flex items-center justify-center"
                        style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.28)" }}>
                        <QrCode size={30} style={{ color: "#C9A84C" }} />
                      </div>
                      {/* Pulse ring */}
                      <motion.div
                        animate={{ scale: [1, 1.6, 1], opacity: [0.35, 0, 0.35] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                        className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{ border: "1px solid rgba(201,168,76,0.5)" }}
                      />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", color: "#C9A84C", textTransform: "uppercase" }}>
                          Flagship feature
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <p className="font-bold text-white text-[15px] tracking-tight leading-tight">
                        Scan any UPI QR code to pay
                      </p>
                      <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                        Google Pay · PhonePe · Paytm · 300M+ merchants · zero setup
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 group-hover:translate-x-0.5"
                      style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.2)" }}>
                      <ArrowRight size={14} style={{ color: "#C9A84C" }} />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="relative mt-4 pt-3 flex items-center gap-6 flex-wrap"
                    style={{ borderTop: "1px solid rgba(201,168,76,0.1)" }}>
                    {[["~400ms", "finality"], ["< $0.001", "fee"], ["₹0", "for you"], ["INR", "to merchant"]].map(([val, label]) => (
                      <div key={val} className="flex items-baseline gap-1.5">
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#C9A84C" }}>{val}</span>
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </motion.button>
              </motion.div>

              {/* ── Divider ────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.18 }}
                className="flex items-center gap-3"
              >
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>or type a command</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
              </motion.div>

              {/* ── Suggestion chips — secondary ───────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <motion.button
                      key={s.text}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => handleSubmit(s.text)}
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left border border-white/6 glass transition-all duration-200 hover:border-white/12 group"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${s.color}18`, border: `1px solid ${s.color}22` }}>
                        <Icon size={13} style={{ color: s.color }} />
                      </div>
                      <span className="text-gray-400 text-xs group-hover:text-gray-200 transition-colors leading-tight">{s.text}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        {messages.map((msg, i) => (
          <MessageBubble key={msg.id} message={msg} index={i} />
        ))}

        {/* Typing indicator — 3 dots while waiting for first chunk */}
        <AnimatePresence>
          {isLoading && !streamingContent && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-end gap-2"
            >
              <div className="w-7 h-7 rounded-full btn-violet flex items-center justify-center shrink-0">
                <Sparkles size={12} className="text-white" />
              </div>
              <div className="chat-bubble-assistant px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-violet-400" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-violet-400" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-violet-400" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streaming bubble — text appears character by character */}
        <AnimatePresence>
          {streamingContent && (
            <motion.div
              initial={{ opacity: 0, y: 8, x: -12 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-end gap-2"
            >
              <div className="w-7 h-7 rounded-full btn-violet flex items-center justify-center shrink-0 mb-1">
                <Sparkles size={12} className="text-white" />
              </div>
              <div className="chat-bubble-assistant px-4 py-3 text-sm leading-relaxed text-gray-100 max-w-[80%]">
                {streamingContent}
                {/* Blinking cursor */}
                <span
                  className="inline-block w-0.5 h-[1em] bg-violet-400 ml-0.5 align-middle animate-pulse"
                  aria-hidden="true"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ────────────────────────────────────────────── */}
      <div className="px-4 pb-5 pt-2 space-y-2">

        {/* QR pill — shown when conversation is active (not empty state) */}
        <AnimatePresence>
          {!isEmpty && (
            <motion.div
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 4, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.button
                onClick={() => setShowQRScanner(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 w-full transition-all duration-150 group"
                style={{
                  background: "rgba(201,168,76,0.05)",
                  border: "1px solid rgba(201,168,76,0.16)",
                }}
              >
                <QrCode size={13} style={{ color: "#C9A84C" }} />
                <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(201,168,76,0.85)", letterSpacing: "0.01em" }}>
                  Scan UPI QR to pay
                </span>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.18)", marginLeft: "auto" }}>
                  300M+ merchants supported
                </span>
                <ArrowRight size={11} style={{ color: "rgba(201,168,76,0.5)" }} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className={cn(
            "flex items-end gap-2 rounded-2xl px-4 py-3",
            "glass border border-white/8 input-glow transition-all duration-200"
          )}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={isConnected ? "Type what you want to do…" : "Connect wallet to get started…"}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 resize-none outline-none leading-6 disabled:opacity-50"
          />

          {/* QR — icon only inside input bar (empty state already shows the hero) */}
          {isEmpty && (
            <motion.button
              onClick={() => setShowQRScanner(true)}
              whileTap={{ scale: 0.9 }}
              title="Scan UPI QR to pay"
              className="p-2.5 rounded-xl transition-all duration-150 shrink-0"
              style={{ color: "#C9A84C", background: "rgba(201,168,76,0.08)" }}
            >
              <QrCode size={16} />
            </motion.button>
          )}

          {/* Voice */}
          <motion.button
            onClick={toggleVoice}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "p-2.5 rounded-xl transition-all duration-150 shrink-0",
              isListening
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/6"
            )}
          >
            {isListening
              ? <><MicOff size={16} /><span className="sr-only">Stop</span></>
              : <Mic size={16} />
            }
          </motion.button>

          {/* Send */}
          <motion.button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            whileHover={input.trim() && !isLoading ? { scale: 1.05 } : {}}
            whileTap={input.trim() && !isLoading ? { scale: 0.9 } : {}}
            className={cn(
              "p-2.5 rounded-xl transition-all duration-150 shrink-0",
              input.trim() && !isLoading
                ? "btn-violet text-white"
                : "text-gray-700 cursor-not-allowed bg-white/3"
            )}
          >
            <Send size={16} />
          </motion.button>
        </motion.div>

        <p className="text-center text-gray-700 text-[10px] mt-1 tracking-wide">
          Auron is in testnet — do not use real funds
        </p>
      </div>

      {/* ── Confirm overlay ───────────────────────────────────────── */}
      <AnimatePresence>
        {pendingTx && (
          <ConfirmCard
            confirmText={pendingTx.confirmText}
            action={pendingTx.action}
            securityFlags={pendingTx.securityFlags}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isExecuting={isExecuting}
          />
        )}
      </AnimatePresence>

      {/* ── Success reveal ────────────────────────────────────────── */}
      <AnimatePresence>
        {completedTx && (
          <RevealCard
            txHash={completedTx.txHash}
            onClose={() => setCompletedTx(null)}
          />
        )}
      </AnimatePresence>

      {/* ── QR Scanner overlay ────────────────────────────────────── */}
      <AnimatePresence>
        {showQRScanner && (
          <QRScanner
            onScan={handleQRScan}
            onClose={() => setShowQRScanner(false)}
          />
        )}
      </AnimatePresence>

      {/* ── QR Amount Entry — static QR, no amount embedded ──────── */}
      <AnimatePresence>
        {qrMerchantContext && (
          <QRAmountEntry
            merchantName={qrMerchantContext.merchantName}
            upiId={qrMerchantContext.upiId}
            onConfirm={handleQRAmountConfirm}
            onCancel={() => setQrMerchantContext(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Payment Status Tracker ────────────────────────────────── */}
      <AnimatePresence>
        {activePayment && !showReceipt && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
            <PaymentStatusTracker
              payment={activePayment}
              onRetry={() => {
                // Re-submit the original payment message to restart
                const msg = activePayment.inrAmount
                  ? `Pay ₹${activePayment.inrAmount} to ${activePayment.merchantName ?? activePayment.merchantUpiId} via UPI ID ${activePayment.merchantUpiId}`
                  : `Pay to ${activePayment.merchantUpiId}`;
                setActivePayment(null);
                setTimeout(() => handleSubmit(msg), 100);
              }}
              onRequestRefund={handleRequestRefund}
              onViewReceipt={() => setShowReceipt(true)}
              onDismiss={() => {
                paymentStore.setActivePayment(null);
                setActivePayment(null);
              }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Payment Receipt ───────────────────────────────────────── */}
      <AnimatePresence>
        {activePayment && showReceipt && (
          <PaymentReceipt
            payment={activePayment}
            onClose={() => setShowReceipt(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

export default ChatInterface;

// ── Message bubble ────────────────────────────────────────────────
function MessageBubble({ message, index: _index }: { readonly message: ChatMessage; readonly index: number }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex justify-center"
      >
        <span className="text-xs text-gray-500 bg-white/4 border border-white/6 px-3 py-1.5 rounded-full">
          {message.content}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, x: isUser ? 12 : -12 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex items-end gap-2", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full btn-violet flex items-center justify-center shrink-0 mb-1">
          <Sparkles size={12} className="text-white" />
        </div>
      )}
      <div className="max-w-[80%] space-y-1">
        <div className={cn("px-4 py-3 text-sm leading-relaxed", isUser ? "chat-bubble-user text-white" : "chat-bubble-assistant text-gray-100")}>
          {message.content}
        </div>
        <p className={cn("text-[10px] text-gray-600 px-1", isUser && "text-right")}>
          {formatTimestamp(message.timestamp / 1000)}
        </p>
      </div>
    </motion.div>
  );
}
