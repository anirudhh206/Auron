"use client";

declare global {
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

import { useRef, useEffect, useState, useCallback, type ChangeEvent } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { type EncodeObject } from "@cosmjs/proto-signing";
import { Send, Mic, MicOff, Sparkles } from "lucide-react";
import { useStore, ChatMessage } from "@/store/useStore";
import { cn, formatTimestamp } from "@/lib/utils";
import ConfirmCard from "./ConfirmCard";
import RevealCard from "./RevealCard";
import { buildTransferMsg, buildStampAgreementMsg, buildLockMsg, buildStampOwnershipMsg, buildClaimYieldMsg } from "@/lib/contracts";
import { CONTRACTS } from "@/lib/initia";
import { isAllowedContract } from "@/lib/security";

// ── Suggestion chips shown on empty chat ─────────────────────────
const SUGGESTIONS = [
  "Send ₹500 to Priya",
  "Lock ₹2000 for 3 months",
  "Arjun owes me ₹1500 — save the agreement",
  "Prove I own this photo",
];

export default function ChatInterface() {
  const {
    address,
    isConnected,
    openConnect,
    requestTxBlock,
  } = useInterwovenKit();

  const {
    messages,
    addMessage,
    pendingTx,
    setPendingTx,
    isLoading,
    setLoading,
    prefs,
    dailySpent,
    addDailySpent,
    addCompletedTx,
  } = useStore();

  const [input, setInput]         = useState("");
  const [isListening, setListening] = useState(false);
  const [completedTx, setCompletedTx] = useState<{ txHash: string; confirmText: string } | null>(null);
  const [isExecuting, setExecuting]   = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Voice input ────────────────────────────────────────────────
  function toggleVoice() {
    if (!("webkitSpeechRecognition" in globalThis || "SpeechRecognition" in globalThis)) {
      addMessage({ role: "system", content: "Voice input isn't supported in this browser. Try Chrome." });
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition;
    const r = new SR() as SpeechRecognition;
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      setListening(false);
    };
    r.onerror = () => setListening(false);
    r.onend   = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }

  // ── Textarea auto-resize ───────────────────────────────────────
  function handleInputChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  // ── Submit message ─────────────────────────────────────────────
  const handleSubmit = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;

    if (!isConnected) {
      openConnect();
      return;
    }

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    addMessage({ role: "user", content: msg });
    setLoading(true);

    try {
      const res = await fetch("/api/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          userId: address,
          spendCeiling: prefs.spendCeiling,
          dailyCap: prefs.dailyCap,
          dailySpent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        addMessage({ role: "assistant", content: data.error ?? "Something went wrong. Please try again." });
        return;
      }

      // AI needs clarification
      if (data.type === "clarification") {
        addMessage({ role: "assistant", content: data.question });
        return;
      }

      // Daily cap check (client-side layer 6)
      if (data.action?.amount && data.action.action === "transfer") {
        if (dailySpent + data.action.amount > prefs.dailyCap) {
          addMessage({
            role: "assistant",
            content: `⛔ This would exceed your daily limit of ₹${prefs.dailyCap.toLocaleString("en-IN")}. You've spent ₹${dailySpent.toLocaleString("en-IN")} today. Raise your cap in Settings after a 24-hour cooldown.`,
          });
          return;
        }
      }

      // Action ready — show confirm card
      addMessage({ role: "assistant", content: data.confirmText });
      setPendingTx({
        action: data.action,
        confirmText: data.confirmText,
        securityFlags: data.securityFlags,
        requiresSlowdown: data.requiresSlowdown,
      });

    } catch {
      addMessage({ role: "assistant", content: "Network error. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }, [input, isLoading, isConnected, address, prefs, dailySpent, addMessage, setLoading, setPendingTx, openConnect]);

  // ── Build transaction message from action ─────────────────────
  async function buildTxMessage(action: any, confirmText: string): Promise<EncodeObject> {
    switch (action.action) {
      case "transfer":
        return buildTransferTx(action);
      case "stamp_agreement":
        return buildAgreementTx(action, confirmText);
      case "lock_savings":
        return buildLockTx(action);
      case "stamp_ownership":
        return buildOwnershipTx(action);
      case "claim_yield":
        return buildClaimTx(action);
      default:
        throw new Error("Unknown action type");
    }
  }

  async function buildTransferTx(action: any): Promise<EncodeObject> {
    const contractAddress = CONTRACTS.transfer;
    if (!isAllowedContract(contractAddress)) throw new Error("Contract not whitelisted");
    const amountUcless = String(Math.floor((action.amount ?? 0) * 1_000_000));
    return buildTransferMsg(contractAddress, address, action.recipient ?? "", amountUcless, action.note ?? undefined);
  }

  async function buildAgreementTx(action: any, confirmText: string): Promise<EncodeObject> {
    const contractAddress = CONTRACTS.agreement;
    if (!isAllowedContract(contractAddress)) throw new Error("Contract not whitelisted");
    const contentHash = await sha256(action.description ?? confirmText);
    return buildStampAgreementMsg(contractAddress, address, contentHash, action.recipient ?? "", action.description ?? "", "5000000");
  }

  async function buildLockTx(action: any): Promise<EncodeObject> {
    const contractAddress = CONTRACTS.timelock;
    if (!isAllowedContract(contractAddress)) throw new Error("Contract not whitelisted");
    const amountUcless = String(Math.floor((action.amount ?? 0) * 1_000_000));
    const unlockAt = Math.floor(Date.now() / 1000) + (action.duration_days ?? 30) * 86400;
    return buildLockMsg(contractAddress, address, amountUcless, unlockAt, action.description ?? "Savings lock");
  }

  async function buildOwnershipTx(action: any): Promise<EncodeObject> {
    const contractAddress = CONTRACTS.ownership;
    if (!isAllowedContract(contractAddress)) throw new Error("Contract not whitelisted");
    if (!action.file_hash) throw new Error("File hash missing — please attach your file first.");
    return buildStampOwnershipMsg(contractAddress, address, action.file_hash, action.file_name ?? "file", action.description ?? "", "2000000");
  }

  async function buildClaimTx(action: any): Promise<EncodeObject> {
    const contractAddress = CONTRACTS.timelock;
    if (!isAllowedContract(contractAddress)) throw new Error("Contract not whitelisted");
    if (!action.vault_id) throw new Error("Which vault? Say 'claim yield from vault-1'");
    return buildClaimYieldMsg(contractAddress, address, action.vault_id);
  }

  // ── Execute confirmed transaction ──────────────────────────────
  async function handleConfirm() {
    if (!pendingTx || !address) return;
    setExecuting(true);

    const { action, confirmText } = pendingTx;

    try {
      const msg = await buildTxMessage(action);

      const result = await requestTxBlock({
        messages: [msg],
        memo: `Auron: ${action.action}`,
        chainId: process.env.NEXT_PUBLIC_CHAIN_ID ?? "auron-1",
      });

      if (result.code !== 0) throw new Error("Transaction failed");

      if (action.action === "transfer" && action.amount) {
        addDailySpent(action.amount);
      }

      const completed = {
        id: crypto.randomUUID(),
        action,
        txHash: result.transactionHash,
        timestamp: Date.now(),
        confirmText,
      };

      addCompletedTx(completed);
      setCompletedTx({ txHash: result.transactionHash, confirmText });
      setPendingTx(null);

    } catch (err: any) {
      addMessage({
        role: "assistant",
        content: `❌ Transaction failed: ${err?.message ?? "Unknown error"}. Please try again.`,
      });
      setPendingTx(null);
    } finally {
      setExecuting(false);
    }
  }

  function handleCancel() {
    setPendingTx(null);
    addMessage({ role: "assistant", content: "Cancelled. What would you like to do?" });
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Messages area ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-8 animate-fade-in">
            <div className="text-center space-y-2">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-2xl font-bold text-white">
                What do you want to do?
              </h2>
              <p className="text-gray-400 text-sm max-w-xs">
                Type anything in plain English. Auron figures out the rest.
              </p>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubmit(s)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm border",
                    "border-white/10 text-gray-300 hover:border-violet-500/60",
                    "hover:text-white hover:bg-violet-500/10",
                    "transition-all duration-150"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-end gap-2 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Sparkles size={12} className="text-violet-400" />
            </div>
            <div className="chat-bubble-assistant px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────── */}
      <div className="px-4 pb-6 pt-2">
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl p-3",
            "bg-[#1c2333] border border-white/10",
            "input-glow transition-all duration-200"
          )}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              isConnected
                ? "Type what you want to do…"
                : "Connect wallet to get started…"
            }
            disabled={isLoading}
            rows={1}
            className={cn(
              "flex-1 bg-transparent text-white text-sm placeholder-gray-500",
              "resize-none outline-none leading-6",
              "disabled:opacity-50"
            )}
          />

          {/* Voice button */}
          <button
            onClick={toggleVoice}
            className={cn(
              "p-2 rounded-xl transition-colors shrink-0",
              isListening
                ? "bg-red-500/20 text-red-400"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/6"
            )}
            title="Voice input"
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* Send button */}
          <button
            type="button"
            aria-label="Send message"
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            className={cn(
              "p-2 rounded-xl transition-all shrink-0",
              input.trim() && !isLoading
                ? "bg-violet-600 hover:bg-violet-500 text-white"
                : "text-gray-600 cursor-not-allowed"
            )}
          >
            <Send size={18} />
          </button>
        </div>

        <p className="text-center text-gray-600 text-[10px] mt-2">
          Auron is in testnet — do not use real funds
        </p>
      </div>

      {/* ── Confirm card overlay ─────────────────────────────────── */}
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

      {/* ── Success reveal card ──────────────────────────────────── */}
      {completedTx && (
        <RevealCard
          txHash={completedTx.txHash}
          confirmText={completedTx.confirmText}
          onClose={() => setCompletedTx(null)}
        />
      )}
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────
function MessageBubble({ message }: { readonly message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center animate-fade-in">
        <span className="text-xs text-gray-500 bg-white/4 px-3 py-1.5 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-end gap-2 animate-slide-up",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 mb-1">
          <Sparkles size={12} className="text-violet-400" />
        </div>
      )}

      <div className="max-w-[80%] space-y-1">
        <div
          className={cn(
            "px-4 py-3 text-sm leading-relaxed",
            isUser ? "chat-bubble-user text-white" : "chat-bubble-assistant text-gray-100"
          )}
        >
          {message.content}
        </div>
        <p className={cn("text-[10px] text-gray-600 px-1", isUser && "text-right")}>
          {formatTimestamp(message.timestamp / 1000)}
        </p>
      </div>
    </div>
  );
}

// ── SHA-256 helper (Web Crypto API — works in browser + edge) ──
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
