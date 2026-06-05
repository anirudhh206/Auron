"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ScannedUPIData {
  upiId: string;
  merchantName: string;
  amount: number | null;
}

interface QRScannerScreenProps {
  onScanned: (data: ScannedUPIData) => void;
  onBack: () => void;
}

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  bg:     "#08080A",
  s1:     "#0F0F12",
  border: "#26262A",
  text:   "#F5F5F0",
  muted:  "#9A9AA8",
  dim:    "#606068",
  lime:   "#C8F135",
};

// ─── Parse UPI QR string ───────────────────────────────────────────────────────
function parseUPIQR(raw: string): ScannedUPIData | null {
  try {
    // Standard UPI deep-link: upi://pay?pa=...&pn=...&am=...
    if (raw.startsWith("upi://")) {
      const url = new URL(raw.replace("upi://pay", "https://pay.upi"));
      const pa = url.searchParams.get("pa");
      const pn = url.searchParams.get("pn");
      const am = url.searchParams.get("am");
      if (!pa) return null;
      return {
        upiId: pa,
        merchantName: pn ? decodeURIComponent(pn.replace(/\+/g, " ")) : pa.split("@")[0],
        amount: am ? parseFloat(am) : null,
      };
    }
    // Bare UPI ID (e.g. merchant@upi)
    if (/^[\w.\-]+@[\w]+$/.test(raw.trim())) {
      const id = raw.trim();
      return { upiId: id, merchantName: id.split("@")[0], amount: null };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function QRScannerScreen({ onScanned, onBack }: QRScannerScreenProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const [status, setStatus]       = useState<"init" | "scanning" | "error" | "success">("init");
  const [errorMsg, setErrorMsg]   = useState("");
  const [scanned, setScanned]     = useState<ScannedUPIData | null>(null);
  const [torchOn, setTorchOn]     = useState(false);
  const [hasTorch, setHasTorch]   = useState(false);
  const [scanFlash, setScanFlash] = useState(false);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  // ── Start ZXing scanner ────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setStatus("init");
    setErrorMsg("");

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();

      if (!videoRef.current) return;

      const controls = await reader.decodeFromVideoDevice(
        undefined,          // undefined = environment-facing camera
        videoRef.current,
        (result, _scanErr) => {
          if (result) {
            const text = result.getText();
            const parsed = parseUPIQR(text);
            if (parsed) {
              setScanFlash(true);
              setScanned(parsed);
              setStatus("success");
              stopScanner();
              if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
              setTimeout(() => onScanned(parsed), 700);
            }
          }
          // err is non-null on every frame that has no QR — normal, ignore
        }
      );

      controlsRef.current = controls;
      setStatus("scanning");

      // Check torch after stream starts
      const stream = videoRef.current?.srcObject as MediaStream | null;
      if (stream) {
        const track = stream.getVideoTracks()[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = track?.getCapabilities?.() as any;
        if (caps?.torch) setHasTorch(true);
      }
    } catch (err: unknown) {
      const errObj = err as { name?: string } | null;
      const denied =
        errObj?.name === "NotAllowedError" ||
        errObj?.name === "PermissionDeniedError" ||
        String(err).includes("Permission denied");
      setErrorMsg(
        denied
          ? "Camera permission denied. Please allow camera access and try again."
          : "Could not open camera. Make sure no other app is using it."
      );
      setStatus("error");
    }
  }, [onScanned, stopScanner]);

  useEffect(() => {
    startScanner();
    return () => stopScanner();
  }, [startScanner, stopScanner]);

  const toggleTorch = useCallback(async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const next = !torchOn;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (track.applyConstraints as any)({ advanced: [{ torch: next }] });
    setTorchOn(next);
  }, [torchOn]);

  // ── Corner marks ──────────────────────────────────────────────────────────
  const CORNER = 20;
  const cornerStyles: React.CSSProperties[] = [
    { top: 0, left: 0, borderTop: "2px solid", borderLeft: "2px solid", borderRight: "none", borderBottom: "none" },
    { top: 0, right: 0, borderTop: "2px solid", borderRight: "2px solid", borderLeft: "none", borderBottom: "none" },
    { bottom: 0, left: 0, borderBottom: "2px solid", borderLeft: "2px solid", borderTop: "none", borderRight: "none" },
    { bottom: 0, right: 0, borderBottom: "2px solid", borderRight: "2px solid", borderTop: "none", borderLeft: "none" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      background: C.bg,
      display: "flex", flexDirection: "column",
      fontFamily: "'Geist', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
        @keyframes scanLine {
          0%   { top: 2px; opacity: 1; }
          85%  { top: calc(100% - 4px); opacity: 1; }
          100% { top: calc(100% - 4px); opacity: 0; }
        }
        @keyframes scanFlash {
          0%   { background: rgba(200,241,53,0); }
          35%  { background: rgba(200,241,53,0.22); }
          100% { background: rgba(200,241,53,0); }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 20px",
        background: "rgba(8,8,10,0.94)",
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: "blur(20px)",
        flexShrink: 0, zIndex: 10,
      }}>
        <button
          onClick={() => { stopScanner(); onBack(); }}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: C.s1, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M5 12l7 7M5 12l7-7"/>
          </svg>
        </button>
        <div>
          <p style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Scan QR</p>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: "2px 0 0", letterSpacing: "0.06em" }}>
            Point at any UPI QR code
          </p>
        </div>
      </div>

      {/* ── Camera area ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* Video element — ZXing writes stream directly here */}
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            opacity: status === "scanning" || status === "success" ? 1 : 0,
            transition: "opacity 0.4s",
          }}
        />

        {/* Flash overlay */}
        {scanFlash && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none",
            animation: "scanFlash 0.55s ease forwards",
          }} />
        )}

        {/* Vignette */}
        {(status === "scanning" || status === "success") && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
            background: "radial-gradient(ellipse 65% 58% at 50% 50%, transparent 28%, rgba(0,0,0,0.58) 100%)",
          }} />
        )}

        {/* Reticule */}
        {status === "scanning" && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -56%)",
            width: 224, height: 224,
            zIndex: 3,
          }}>
            {cornerStyles.map((style, i) => (
              <div key={i} style={{
                position: "absolute",
                width: CORNER, height: CORNER,
                borderColor: C.lime,
                borderRadius: 3,
                ...style,
              }} />
            ))}
            {/* Scan line */}
            <div style={{
              position: "absolute",
              left: 4, right: 4, height: 2,
              background: `linear-gradient(90deg, transparent, ${C.lime}, transparent)`,
              boxShadow: `0 0 10px ${C.lime}80`,
              animation: "scanLine 2.2s ease-in-out infinite",
              borderRadius: 999,
            }} />
          </div>
        )}

        {/* Success checkmark */}
        <AnimatePresence>
          {status === "success" && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              style={{
                position: "absolute",
                top: "50%", left: "50%",
                transform: "translate(-50%, -56%)",
                width: 88, height: 88, zIndex: 4,
                borderRadius: "50%",
                background: "rgba(200,241,53,0.14)",
                border: `2px solid ${C.lime}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 32px rgba(200,241,53,0.25)`,
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{
              position: "absolute", inset: 0, zIndex: 4,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "0 32px", gap: 20,
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: "0 0 8px" }}>Camera Error</p>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.65 }}>
                {errorMsg}
              </p>
            </div>
            <button
              onClick={startScanner}
              style={{
                padding: "10px 28px", borderRadius: 10,
                background: C.lime, border: "none",
                fontFamily: "'Geist',sans-serif", fontSize: 13, fontWeight: 700,
                color: "#0A0A08", cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* Init spinner */}
        {status === "init" && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                border: `2px solid ${C.border}`,
                borderTopColor: C.lime,
              }}
            />
          </div>
        )}

        {/* Hint */}
        {status === "scanning" && (
          <p style={{
            position: "absolute", bottom: "18%", left: 0, right: 0,
            textAlign: "center",
            fontFamily: "'Geist Mono',monospace",
            fontSize: 11, color: C.muted, letterSpacing: "0.1em",
            zIndex: 3, pointerEvents: "none", margin: 0,
          }}>
            ALIGN QR CODE IN FRAME
          </p>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 28px 32px",
        background: "rgba(8,8,10,0.97)",
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        {/* Torch */}
        <button
          onClick={hasTorch ? toggleTorch : undefined}
          disabled={!hasTorch}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: hasTorch ? "pointer" : "default",
            opacity: hasTorch ? 1 : 0.28,
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            background: torchOn ? "rgba(200,241,53,0.1)" : C.s1,
            border: `1px solid ${torchOn ? C.lime : C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={torchOn ? C.lime : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: torchOn ? C.lime : C.dim, letterSpacing: "0.07em" }}>
            TORCH
          </span>
        </button>

        {/* Status pill */}
        <div style={{ textAlign: "center", minWidth: 120 }}>
          <AnimatePresence mode="wait">
            {status === "success" && scanned ? (
              <motion.div key="success" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.lime, letterSpacing: "0.08em", margin: "0 0 3px" }}>
                  ✓ DETECTED
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
                  {scanned.merchantName}
                </p>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.muted, margin: "2px 0 0" }}>
                  {scanned.upiId}
                </p>
              </motion.div>
            ) : (
              <motion.p
                key="status"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, letterSpacing: "0.08em", margin: 0 }}
              >
                {status === "scanning" ? "SCANNING…" : status === "init" ? "STARTING…" : "ERROR"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Type manually */}
        <button
          onClick={() => { stopScanner(); onBack(); }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            background: C.s1, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.07em" }}>
            TYPE
          </span>
        </button>
      </div>
    </div>
  );
}
