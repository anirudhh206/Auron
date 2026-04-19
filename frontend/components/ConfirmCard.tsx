"use client";

import { useState, useEffect, useRef } from "react";
import { SecurityFlag } from "@/lib/security";
import { ParsedAction } from "@/lib/claude";

interface ConfirmCardProps {
  readonly confirmText: string;
  readonly action: ParsedAction;
  readonly securityFlags: SecurityFlag[];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly isExecuting: boolean;
}

export default function ConfirmCard({
  confirmText,
  action,
  securityFlags,
  onConfirm,
  onCancel,
  isExecuting,
}: ConfirmCardProps) {
  const [cooldown, setCooldown] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRef = useRef<NodeJS.Timeout | null>(null);
  const holdStart = useRef<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    progressBarRef.current?.style.setProperty("--hold-progress", `${holdProgress * 100}%`);
  }, [holdProgress]);

  const urgencyFlag = securityFlags.find((f) => f.type === "URGENCY_DETECTED");
  const aboveFlag = securityFlags.find(
    (f) => f.type === "ABOVE_CEILING" || f.type === "EXTREME_AMOUNT"
  );
  const needsHold = !!aboveFlag;
  const holdMs = aboveFlag && "holdDurationMs" in aboveFlag ? aboveFlag.holdDurationMs : 0;

  // Urgency cooldown timer
  useEffect(() => {
    if (urgencyFlag) {
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(interval);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [urgencyFlag]);

  const buttonBlocked = cooldown > 0 || isExecuting;

  const startHold = () => {
    if (buttonBlocked) return;
    holdStart.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - holdStart.current;
      const progress = Math.min(elapsed / holdMs, 1);
      setHoldProgress(progress);
      if (progress < 1) {
        holdRef.current = setTimeout(tick, 16);
      } else {
        onConfirm();
      }
    };
    holdRef.current = setTimeout(tick, 16);
  };

  const cancelHold = () => {
    if (holdRef.current) clearTimeout(holdRef.current);
    setHoldProgress(0);
  };

  const actionIcon: Record<string, string> = {
    transfer: "💸",
    stamp_agreement: "🤝",
    lock_savings: "🔒",
    stamp_ownership: "📎",
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">{actionIcon[action.action ?? "transfer"] ?? "⚡"}</span>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Confirm Action</p>
            <p className="text-white font-semibold text-lg leading-tight">{confirmText}</p>
          </div>
        </div>

        {/* Security alerts */}
        {urgencyFlag && (
          <div className="bg-red-950 border border-red-700 rounded-xl p-4">
            <p className="text-red-300 text-sm font-medium">⚠️ Urgency language detected</p>
            <p className="text-red-400 text-xs mt-1">
              Scammers often create false urgency. Take a breath.
              {cooldown > 0 && <span className="font-bold"> Wait {cooldown}s before confirming.</span>}
            </p>
          </div>
        )}

        {aboveFlag && (
          <div className="bg-yellow-950 border border-yellow-700 rounded-xl p-4">
            <p className="text-yellow-300 text-sm font-medium">
              {aboveFlag.type === "EXTREME_AMOUNT" ? "🚨 Unusually large amount" : "⚡ Above your spend ceiling"}
            </p>
            <p className="text-yellow-400 text-xs mt-1">Hold the button to confirm.</p>
          </div>
        )}

        {/* Amount detail */}
        {action.amount && (
          <div className="bg-gray-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Amount</p>
              <p className="text-white font-semibold">{action.amount.toLocaleString()}</p>
            </div>
            {action.recipient && (
              <div>
                <p className="text-gray-400 text-xs">To</p>
                <p className="text-white font-semibold">{action.recipient}</p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isExecuting}
            className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-300 font-medium hover:bg-gray-800 transition disabled:opacity-40"
          >
            No, cancel
          </button>

          {needsHold ? (
            <button
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              disabled={buttonBlocked}
              className="flex-1 relative py-3 rounded-xl bg-violet-600 text-white font-semibold overflow-hidden disabled:opacity-40"
            >
              <div
                ref={progressBarRef}
                className="absolute left-0 top-0 h-full bg-violet-400 transition-none hold-bar"
              />
              <span className="relative">Hold to confirm</span>
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={buttonBlocked}
              className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition disabled:opacity-40"
            >
              {cooldown > 0 ? `Wait ${cooldown}s` : confirmLabel(isExecuting)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function confirmLabel(executing: boolean): string {
  if (executing) return "Sending…";
  return "Yes, confirm";
}
