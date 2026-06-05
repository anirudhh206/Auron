"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLiveRate } from "@/lib/useLiveRate";
import { motion, AnimatePresence } from "framer-motion";
import { BrowserQRCodeReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

// Native BarcodeDetector type (Chrome 83+ / Android Chrome)
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}
import { X, Camera, RefreshCw, CheckCircle2, ArrowRight, Wallet } from "lucide-react";
import AuronLogo from "@/components/AuronLogo";

// ─── UPI QR ───────────────────────────────────────────────────────────────────
export interface ParsedUPI {
  pa: string;        // payee address (UPI ID)
  pn: string;        // payee name
  am: number | null; // amount in INR (null = open amount)
  cu: string;        // currency (always "INR")
  tn: string | null; // transaction note
}

// ─── Solana Pay QR ────────────────────────────────────────────────────────────
export interface ParsedSolanaPayQR {
  recipient: string;       // base58 Solana public key
  amount: number | null;   // token amount (null = open amount)
  splToken: string | null; // SPL token mint (null = native SOL)
  label: string | null;    // display name
  message: string | null;  // memo/message
  reference: string | null;// reference key for tracking
}

// ─── Discriminated union ──────────────────────────────────────────────────────
export type ParsedQRResult =
  | { type: "upi";    data: ParsedUPI }
  | { type: "solana"; data: ParsedSolanaPayQR };

// ─── Props ────────────────────────────────────────────────────────────────────
interface QRScannerProps {
  onScan: (result: ParsedQRResult) => void;
  onClose: () => void;
}

// ─── UPI QR parser ────────────────────────────────────────────────────────────
function parseUPIQR(text: string): ParsedUPI | null {
  try {
    if (!text.toLowerCase().startsWith("upi://")) return null;
    // Standard format: "upi://pay?pa=xxx&pn=yyy&am=zzz&cu=INR&tn=note"
    // We extract everything after the first '?' as the query string.
    // This correctly handles the common "upi://pay?..." shape where "pay" is
    // a path segment — the old URL-normalization approach produced the wrong
    // key "pay?pa" instead of "pa", causing every real UPI QR to be rejected.
    const qIdx = text.indexOf("?");
    // If there's no '?', treat everything after "upi://" as query params
    // (some generators omit the path and write "upi://pa=xxx&...")
    const queryStr = qIdx === -1 ? text.slice("upi://".length) : text.slice(qIdx + 1);
    const params = new URLSearchParams(queryStr);
    const pa = params.get("pa")?.trim() ?? "";
    if (!pa) return null;
    const pn = params.get("pn")?.trim() || pa.split("@")[0];
    const amStr = params.get("am")?.trim();
    const am = amStr ? parseFloat(amStr) : null;
    const cu = params.get("cu")?.trim() || "INR";
    const tn = params.get("tn")?.trim() || null;
    return { pa, pn, am: Number.isFinite(am) ? am : null, cu, tn };
  } catch {
    return null;
  }
}

// ─── Solana Pay QR parser ─────────────────────────────────────────────────────
function parseSolanaPayQR(text: string): ParsedSolanaPayQR | null {
  try {
    // Solana Pay spec: solana:<recipient>[?amount=<value>&spl-token=<mint>&label=<label>&message=<msg>&reference=<key>]
    if (!text.startsWith("solana:")) return null;

    const withoutScheme = text.slice("solana:".length);
    const qIdx = withoutScheme.indexOf("?");
    const recipient = qIdx === -1 ? withoutScheme : withoutScheme.slice(0, qIdx);
    const queryStr = qIdx === -1 ? "" : withoutScheme.slice(qIdx + 1);

    // Basic sanity: Solana base58 addresses are 32–44 chars
    if (!recipient || recipient.length < 32 || recipient.length > 44) return null;
    // Must be alphanumeric base58 (no O, 0, I, l)
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(recipient)) return null;

    const params = new URLSearchParams(queryStr);
    const amountStr = params.get("amount");
    const amount = amountStr ? parseFloat(amountStr) : null;

    const rawLabel = params.get("label");
    const rawMessage = params.get("message");

    return {
      recipient,
      amount: amount !== null && Number.isFinite(amount) && amount > 0 ? amount : null,
      splToken: params.get("spl-token"),
      label: rawLabel ? decodeURIComponent(rawLabel) : null,
      message: rawMessage ? decodeURIComponent(rawMessage) : null,
      reference: params.get("reference"),
    };
  } catch {
    return null;
  }
}

// ─── Parse any QR text ────────────────────────────────────────────────────────
function parseQR(text: string): ParsedQRResult | null {
  const upi = parseUPIQR(text);
  if (upi) return { type: "upi", data: upi };
  const solana = parseSolanaPayQR(text);
  if (solana) return { type: "solana", data: solana };
  return null;
}

// ─── Short address helper ─────────────────────────────────────────────────────
function shortAddr(addr: string): string {
  if (addr.length < 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannedRef = useRef(false);

  const [scanned, setScanned] = useState<ParsedQRResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  const { auronRate } = useLiveRate();
  const fxRate = auronRate;

  // ── Stop everything ────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    controlsRef.current?.stop(); controlsRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
  }, []);

  // ── Native BarcodeDetector engine (Chrome / Android Chrome) ───────────────
  const startNativeScanner = useCallback(async (video: HTMLVideoElement) => {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    // Snapshot to an offscreen canvas — far more reliable than passing the live
    // video element directly to BarcodeDetector (avoids "no frame data" errors).
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let detecting = false; // guard against overlapping async detect() calls

    const tick = async () => {
      if (scannedRef.current) return;

      // readyState >= 3 (HAVE_FUTURE_DATA) guarantees real pixel data exists.
      // videoWidth > 0 guards against a degenerate 0×0 stream on first frames.
      if (!detecting && video.readyState >= 3 && video.videoWidth > 0 && ctx) {
        detecting = true;
        try {
          // Resize canvas only when video dimensions change (avoids reallocation every frame)
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          ctx.drawImage(video, 0, 0);
          const codes = await detector.detect(canvas);
          for (const code of codes) {
            if (scannedRef.current) break;
            const parsed = parseQR(code.rawValue);
            if (parsed) {
              scannedRef.current = true;
              stopAll();
              setScanned(parsed);
              detecting = false;
              return;
            }
          }
        } catch {
          // Frame not ready or BarcodeDetector threw — skip silently
        }
        detecting = false;
      }

      if (!scannedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopAll]);

  // ── @zxing fallback engine (Firefox / Safari / older Chrome) ──────────────
  const startZxingScanner = useCallback(async (video: HTMLVideoElement) => {
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserQRCodeReader(hints, { delayBetweenScanAttempts: 150 });
    const controls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      video,
      (result) => {
        if (!result || scannedRef.current) return;
        const parsed = parseQR(result.getText());
        if (parsed) {
          scannedRef.current = true;
          controlsRef.current?.stop();
          setScanned(parsed);
        }
      }
    );
    controlsRef.current = controls;
  }, []);

  // ── Main start: acquire stream then pick engine ────────────────────────────
  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    setIsStarting(true);
    setCameraError(null);
    setScanned(null);
    scannedRef.current = false;
    stopAll();

    try {
      // Acquire camera stream manually so we fully control it
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setIsStarting(false);

      // Use native BarcodeDetector if available (Chrome / Android) else @zxing
      const hasNative = "BarcodeDetector" in window;
      if (hasNative) {
        await startNativeScanner(video);
      } else {
        await startZxingScanner(video);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const name = err instanceof DOMException ? err.name : "";
      let errorText: string;
      if (name === "NotAllowedError" || msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
        errorText = "Camera permission denied. Tap the lock icon in the address bar → allow Camera, then tap Try Again.";
      } else if (name === "NotFoundError") {
        errorText = "No camera found on this device.";
      } else if (name === "NotReadableError") {
        errorText = "Camera is in use by another app. Close it and try again.";
      } else {
        errorText = `Could not start camera: ${msg || "unknown error"}. Try reloading.`;
      }
      setCameraError(errorText);
      setIsStarting(false);
    }
  }, [startNativeScanner, startZxingScanner, stopAll]);

  useEffect(() => {
    startScanner();
    return () => stopAll();
  }, [startScanner, stopAll]);

  function handlePay() {
    if (scanned) onScan(scanned);
  }

  function handleScanAgain() {
    setScanned(null);
    scannedRef.current = false;
    startScanner();
  }

  // ── UPI computed values ──────────────────────────────────────────────────────
  const upiData = scanned?.type === "upi" ? scanned.data : null;
  const upiDisplayAmount = upiData?.am
    ? `₹${upiData.am.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`
    : null;
  const upiUsdcNeeded = upiData?.am
    ? (upiData.am / fxRate).toFixed(4)
    : null;

  // ── Solana computed values ───────────────────────────────────────────────────
  const solanaData = scanned?.type === "solana" ? scanned.data : null;
  const solanaDisplayAmount = solanaData?.amount
    ? `${solanaData.amount} ${solanaData.splToken ? "USDC" : "SOL"}`
    : null;

  const qrTypeLabel = scanned?.type === "upi"
    ? "UPI payment ready"
    : scanned?.type === "solana"
    ? "Solana Pay detected"
    : null;

  const payButtonLabel =
    scanned?.type === "upi"
      ? (upiDisplayAmount ? `Pay ${upiDisplayAmount}` : "Continue")
      : scanned?.type === "solana"
      ? (solanaDisplayAmount ? `Send ${solanaDisplayAmount}` : "Continue")
      : "Continue";

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#0A0A0F" }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0 z-10"
        style={{ borderBottom: "1px solid rgba(201,168,76,0.12)" }}
      >
        <div className="flex items-center gap-3">
          <AuronLogo size={28} />
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">Scan to Pay</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              UPI QR · Google Pay · PhonePe · Solana Pay
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-muted)",
          }}
          aria-label="Close scanner"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Camera / Result area ─────────────────────────────────────── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: scanned || cameraError ? 0 : 1,
            transition: "opacity 0.4s ease",
          }}
          muted
          playsInline
        />

        {!scanned && !cameraError && (
          <div
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{
              background:
                "radial-gradient(ellipse 280px 280px at center, transparent 45%, rgba(10,10,15,0.88) 62%)",
            }}
          />
        )}

        <AnimatePresence mode="wait">

          {/* ── Loading ─────────────────────────────────────────────── */}
          {isStarting && !cameraError && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-[2] flex flex-col items-center gap-4"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-16 h-16 rounded-2xl btn-gold flex items-center justify-center"
              >
                <Camera size={28} className="text-[#0A0A0F]" />
              </motion.div>
              <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Starting camera…
              </p>
            </motion.div>
          )}

          {/* ── Scan frame ──────────────────────────────────────────── */}
          {!isStarting && !scanned && !cameraError && (
            <motion.div
              key="frame"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-[2] flex flex-col items-center gap-8"
            >
              <div className="relative w-64 h-64">
                {(
                  [
                    "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-2xl",
                    "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-2xl",
                    "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-2xl",
                    "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-2xl",
                  ] as const
                ).map((cls, i) => (
                  <div
                    key={i}
                    className={`absolute w-9 h-9 ${cls}`}
                    style={{ borderColor: "#C9A84C" }}
                  />
                ))}

                <motion.div
                  animate={{ y: [8, 232, 8] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-4 right-4 h-[2px]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, #C9A84C, #F0D080, #C9A84C, transparent)",
                    boxShadow: "0 0 8px rgba(201,168,76,0.6)",
                  }}
                />
              </div>

              <p
                className="text-sm font-medium text-center max-w-[220px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Point at a UPI QR or Solana Pay QR
              </p>
            </motion.div>
          )}

          {/* ── Camera error ─────────────────────────────────────────── */}
          {cameraError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-[2] flex flex-col items-center gap-5 px-8 text-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                }}
              >
                <Camera size={26} className="text-red-400" />
              </div>
              <p className="text-sm text-red-400 leading-relaxed">{cameraError}</p>
              <button
                onClick={startScanner}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold btn-gold text-[#0A0A0F]"
              >
                <RefreshCw size={14} />
                Try Again
              </button>
            </motion.div>
          )}

          {/* ── Scanned result card ──────────────────────────────────── */}
          {scanned && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="relative z-[2] w-full max-w-sm mx-auto px-5"
            >
              <div
                className="rounded-2xl p-5 space-y-4"
                style={{
                  background: "rgba(201,168,76,0.04)",
                  border: "1px solid rgba(201,168,76,0.22)",
                  backdropFilter: "blur(32px)",
                }}
              >
                {/* Card header */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={
                      scanned.type === "solana"
                        ? { background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }
                        : { background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }
                    }
                  >
                    {scanned.type === "solana"
                      ? <Wallet size={17} style={{ color: "#a78bfa" }} />
                      : <CheckCircle2 size={17} style={{ color: "#C9A84C" }} />
                    }
                  </div>
                  <div className="leading-tight">
                    <p
                      className="text-xs font-bold tracking-wide"
                      style={{ color: scanned.type === "solana" ? "#a78bfa" : "#C9A84C" }}
                    >
                      QR DETECTED
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {qrTypeLabel}
                    </p>
                  </div>
                </div>

                {/* Payment details — UPI */}
                {scanned.type === "upi" && upiData && (
                  <div
                    className="space-y-2.5 pt-1"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <DetailRow label="Merchant" value={upiData.pn || upiData.pa.split("@")[0]} />
                    <DetailRow label="UPI ID" value={upiData.pa} mono />
                    {upiDisplayAmount && (
                      <DetailRow label="Amount" value={upiDisplayAmount} gold />
                    )}
                    {upiData.tn && (
                      <DetailRow label="Note" value={upiData.tn} />
                    )}
                  </div>
                )}

                {/* Payment details — Solana Pay */}
                {scanned.type === "solana" && solanaData && (
                  <div
                    className="space-y-2.5 pt-1"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    {solanaData.label && (
                      <DetailRow label="Recipient" value={solanaData.label} />
                    )}
                    <DetailRow label="Address" value={shortAddr(solanaData.recipient)} mono />
                    {solanaDisplayAmount && (
                      <DetailRow label="Amount" value={solanaDisplayAmount} violet />
                    )}
                    {solanaData.message && (
                      <DetailRow label="Message" value={solanaData.message} />
                    )}
                  </div>
                )}

                {/* Breakdown — UPI: FX conversion */}
                {scanned.type === "upi" && upiData?.am && (
                  <div
                    className="rounded-xl p-3 space-y-2"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p
                      className="text-[9px] font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Payment breakdown
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>You spend</span>
                      <span className="text-[11px] font-semibold text-white">{upiUsdcNeeded} USDC</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>FX rate</span>
                      <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                        1 USDC = ₹{fxRate.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Merchant receives</span>
                      <span className="text-[11px] font-semibold text-emerald-400">{upiDisplayAmount} INR</span>
                    </div>
                    <div
                      className="flex items-center justify-between rounded-lg px-3 py-2 mt-1"
                      style={{
                        background: "rgba(16,185,129,0.08)",
                        border: "1px solid rgba(16,185,129,0.18)",
                      }}
                    >
                      <span className="text-[10px] font-medium text-emerald-400">Your transaction fee</span>
                      <span className="text-[11px] font-black text-emerald-400">₹0</span>
                    </div>
                  </div>
                )}

                {/* Breakdown — Solana Pay: direct transfer */}
                {scanned.type === "solana" && (
                  <div
                    className="rounded-xl p-3 space-y-2"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p
                      className="text-[9px] font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Transfer details
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Network</span>
                      <span className="text-[11px] font-semibold text-white">Solana · ~400ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Type</span>
                      <span className="text-[11px] font-medium text-violet-400">
                        {solanaData?.splToken ? "SPL Token (USDC)" : "Native SOL"}
                      </span>
                    </div>
                    <div
                      className="flex items-center justify-between rounded-lg px-3 py-2 mt-1"
                      style={{
                        background: "rgba(16,185,129,0.08)",
                        border: "1px solid rgba(16,185,129,0.18)",
                      }}
                    >
                      <span className="text-[10px] font-medium text-emerald-400">Network fee</span>
                      <span className="text-[11px] font-black text-emerald-400">&lt; $0.001</span>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={handleScanAgain}
                    className="flex-1 py-3 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Scan Again
                  </button>
                  <motion.button
                    onClick={handlePay}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black text-[#0A0A0F] transition-all ${
                      scanned.type === "solana" ? "btn-violet !text-white" : "btn-gold"
                    }`}
                  >
                    {payButtonLabel}
                    <ArrowRight size={14} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Bottom tagline ───────────────────────────────────────────── */}
      {!scanned && !cameraError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="px-5 pb-8 pt-4 text-center shrink-0"
        >
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Merchant receives INR instantly via UPI.{" "}
            <span style={{ color: "rgba(201,168,76,0.6)" }}>The blockchain is invisible.</span>
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Detail row helper ─────────────────────────────────────────────────────────
function DetailRow({
  label,
  value,
  mono = false,
  gold = false,
  violet = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  gold?: boolean;
  violet?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span
        className={`text-[11px] font-semibold truncate text-right ${mono ? "font-mono text-[10px]" : ""}`}
        style={{
          color: gold ? "#C9A84C" : violet ? "#a78bfa" : "var(--text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
