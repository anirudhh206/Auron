"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────
const T = {
  gold:       "#c9a84c",
  goldDim:    "rgba(201,168,76,0.10)",
  goldBorder: "rgba(201,168,76,0.18)",
  w90:  "rgba(255,255,255,0.90)",
  w45:  "rgba(255,255,255,0.45)",
  w32:  "rgba(255,255,255,0.32)",
  w24:  "rgba(255,255,255,0.24)",
  w18:  "rgba(255,255,255,0.18)",
  w08:  "rgba(255,255,255,0.08)",
  w05:  "rgba(255,255,255,0.05)",
  w04:  "rgba(255,255,255,0.04)",
  green:    "#22c55e",
  bg:       "#04040c",
  bgMid:    "#06060e",
  border:   "0.5px solid rgba(255,255,255,0.06)",
  borderG:  "0.5px solid rgba(201,168,76,0.18)",
  radius:   "10px",
  radiusLg: "16px",
};

// ─────────────────────────────────────────────
// Shared: useInView
// ─────────────────────────────────────────────
function useInView(threshold = 0.18) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─────────────────────────────────────────────
// Shared: animated counter
// ─────────────────────────────────────────────
function useCounter(target: number, active: boolean, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return val;
}

// ─────────────────────────────────────────────
// Shared components
// ─────────────────────────────────────────────
function Eyebrow({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <p style={{
      fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase",
      color: gold ? "rgba(201,168,76,0.65)" : T.w24,
      marginBottom: "20px",
      display: "flex", alignItems: "center", gap: "10px",
    }}>
      <span style={{
        width: "22px", height: "0.5px", display: "inline-block",
        background: gold
          ? "linear-gradient(90deg,rgba(201,168,76,0.7),rgba(201,168,76,0.1))"
          : T.w18,
      }} />
      {children}
    </p>
  );
}

function SectionHead({
  label, title, sub, maxW = 580, gold,
}: {
  label: string; title: React.ReactNode;
  sub?: string; maxW?: number; gold?: boolean;
}) {
  return (
    <div style={{ marginBottom: "52px" }}>
      <Eyebrow gold={gold}>{label}</Eyebrow>
      <h2 style={{
        fontSize: "clamp(2rem,3.2vw,2.8rem)", fontWeight: 400,
        letterSpacing: "-0.04em", lineHeight: 1.08,
        color: T.w90, marginBottom: sub ? "18px" : 0,
      }}>{title}</h2>
      {sub && (
        <p style={{
          fontSize: "15px", lineHeight: 1.85,
          color: T.w32, maxWidth: maxW,
          letterSpacing: "0.005em",
        }}>{sub}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Custom cursor
// ─────────────────────────────────────────────
function CustomCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pos     = useRef({ x: 0, y: 0 });
  const ring    = useRef({ x: 0, y: 0 });
  const hovering = useRef(false);

  useEffect(() => {
    const dot  = dotRef.current;
    const r    = ringRef.current;
    if (!dot || !r) return;

    const move = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
      dot.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 3}px)`;
    };

    let raf: number;
    const animate = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.10;
      ring.current.y += (pos.current.y - ring.current.y) * 0.10;
      const s = hovering.current ? "scale(0.55)" : "scale(1)";
      r.style.transform =
        `translate(${ring.current.x - 18}px, ${ring.current.y - 18}px) ${s}`;
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      hovering.current = !!(t.closest("button") || t.closest("a"));
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseover", over, { passive: true });
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} style={{
        position: "fixed", top: 0, left: 0, zIndex: 9999,
        width: "6px", height: "6px", borderRadius: "50%",
        background: T.gold, pointerEvents: "none",
        willChange: "transform",
      }} />
      <div ref={ringRef} style={{
        position: "fixed", top: 0, left: 0, zIndex: 9998,
        width: "36px", height: "36px", borderRadius: "50%",
        border: `1px solid rgba(201,168,76,0.45)`,
        pointerEvents: "none",
        willChange: "transform",
        transition: "transform 0.15s ease",
      }} />
    </>
  );
}

// ─────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────
export default function AuronLanding() {
  return (
    <>
      <style>{`
        html{scroll-behavior:smooth}
        body{background:#04040c;margin:0}
        @keyframes navpulse{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes fadein{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes pr{0%,100%{opacity:0.5;transform:translate(-50%,-50%) scale(1)}
          50%{opacity:0.9;transform:translate(-50%,-50%) scale(1.018)}}
        .nav-a{font-size:11px;color:rgba(255,255,255,0.28);text-decoration:none;
          letter-spacing:0.04em;transition:color 0.2s;}
        .nav-a:hover{color:rgba(255,255,255,0.7);}
        .fade-in{animation:fadein 0.7s ease forwards;}
        .pipeline-line{
          position:absolute;left:19px;top:0;width:1px;
          background:rgba(255,255,255,0.05);
          transform-origin:top;
        }
        .pipeline-progress{
          position:absolute;left:19px;top:0;width:1px;
          background:linear-gradient(180deg,#c9a84c,rgba(201,168,76,0.1));
          transform-origin:top;transform:scaleY(0);
          transition:transform 1.8s cubic-bezier(0.16,1,0.3,1);
        }
      `}</style>
      <main style={{ background: T.bg, minHeight: "100vh", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
        <Hero />
        <ProofStrip />
        <PipelineSection />
        <FailureSection />
        <InfraSection />
        <StatementSection />
        <SecuritySection />
        <CTASection />
        <Footer />
      </main>
    </>
  );
}

// ─────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────
function Hero() {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const bgRef    = useRef<HTMLCanvasElement>(null);
  const archRef  = useRef<HTMLCanvasElement>(null);
  const beamRef  = useRef<HTMLCanvasElement>(null);
  const glowRef  = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: -9999, y: -9999 });
  const particles= useRef<any[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const initParticles = useCallback((W: number, H: number) => {
    particles.current = Array.from({ length: 130 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.3 + Math.random() * 1.1,
      vx: (Math.random() - 0.5) * 0.10,
      vy: (Math.random() - 0.5) * 0.10,
      a:  0.06 + Math.random() * 0.22,
      gold: Math.random() < 0.30,
    }));
  }, []);

  useEffect(() => {
    const bg   = bgRef.current;
    const arch = archRef.current;
    const beam = beamRef.current;
    const wrap = wrapRef.current;
    if (!bg || !arch || !beam || !wrap) return;

    const bx = bg.getContext("2d")!;
    const ax = arch.getContext("2d")!;
    const mx = beam.getContext("2d")!;

    let W = 0, H = 0, AW = 0, AH = 0;
    let beamY = 0, beamOp = 0, beamState = "idle", beamClock = 0;
    let raf: number;

    const resize = () => {
      const wr = wrap.getBoundingClientRect();
      W = bg.width = beam.width = wr.width;
      H = bg.height = beam.height = wr.height;
      const ar = arch.parentElement!.getBoundingClientRect();
      AW = arch.width  = ar.width;
      AH = arch.height = ar.height;
      initParticles(W, H);
    };

    const drawBg = () => {
      bx.clearRect(0, 0, W, H);
      // Nebula clouds
      [
        { cx: W*0.22, cy: H*0.60, rx: W*0.42, ry: H*0.48, gold: true,  a: 0.060 },
        { cx: W*0.78, cy: H*0.28, rx: W*0.32, ry: H*0.38, gold: false, a: 0.042 },
        { cx: W*0.50, cy: H*0.88, rx: W*0.50, ry: H*0.32, gold: false, a: 0.025 },
        { cx: W*0.08, cy: H*0.18, rx: W*0.22, ry: H*0.28, gold: true,  a: 0.032 },
      ].forEach(c => {
        const maxR = Math.max(c.rx, c.ry);
        const g = bx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, maxR);
        if (c.gold) {
          g.addColorStop(0,   `rgba(201,168,76,${c.a})`);
          g.addColorStop(0.55,`rgba(160,120,40,${c.a*0.35})`);
          g.addColorStop(1,   "rgba(0,0,0,0)");
        } else {
          g.addColorStop(0,   `rgba(80,55,185,${c.a})`);
          g.addColorStop(0.55,`rgba(50,30,145,${c.a*0.35})`);
          g.addColorStop(1,   "rgba(0,0,0,0)");
        }
        bx.save();
        bx.scale(c.rx/maxR, c.ry/maxR);
        bx.beginPath();
        bx.arc(c.cx*maxR/c.rx, c.cy*maxR/c.ry, maxR, 0, Math.PI*2);
        bx.fillStyle = g; bx.fill();
        bx.restore();
      });

      // Mouse glow on canvas
      const { x: px, y: py } = mousePos.current;
      if (px > 0) {
        const mg = bx.createRadialGradient(px, py, 0, px, py, 300);
        mg.addColorStop(0,  "rgba(201,168,76,0.06)");
        mg.addColorStop(0.5,"rgba(90,55,200,0.025)");
        mg.addColorStop(1,  "rgba(0,0,0,0)");
        bx.fillStyle = mg; bx.fillRect(0, 0, W, H);
      }

      // Particles
      particles.current.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        if (px > 0) {
          const dx = p.x - px, dy = p.y - py;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < 110 && d > 0) {
            p.x += (dx/d) * (110-d)/110 * 0.38;
            p.y += (dy/d) * (110-d)/110 * 0.38;
          }
        }
        bx.beginPath();
        bx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        bx.fillStyle = p.gold
          ? `rgba(201,168,76,${p.a})`
          : `rgba(175,165,255,${p.a*0.55})`;
        bx.fill();
      });

      // Scan lines
      for (let y = 0; y < H; y += 3) {
        bx.fillStyle = "rgba(255,255,255,0.005)";
        bx.fillRect(0, y, W, 0.5);
      }
    };

    const drawArch = (ts: number) => {
      ax.clearRect(0, 0, AW, AH);
      const cx = AW/2, cy = AH/2;
      [
        { r: 55,  s: -0.4, e: 0.9,  a: 0.13, gold: true  },
        { r: 82,  s: 1.3,  e: 2.9,  a: 0.09, gold: false },
        { r: 112, s: -0.9, e: 0.5,  a: 0.11, gold: true  },
        { r: 145, s: 1.9,  e: 3.5,  a: 0.07, gold: false },
        { r: 178, s: -0.1, e: 1.7,  a: 0.08, gold: true  },
        { r: 208, s: 1.6,  e: 3.1,  a: 0.05, gold: false },
      ].forEach(arc => {
        const off = Math.sin(ts*0.00038 + arc.r*0.022)*0.09;
        ax.beginPath();
        ax.arc(cx, cy, arc.r, arc.s+off, arc.e+off);
        ax.strokeStyle = arc.gold
          ? `rgba(201,168,76,${arc.a})`
          : `rgba(110,90,220,${arc.a})`;
        ax.lineWidth = 0.6; ax.stroke();
        const ex = cx + arc.r*Math.cos(arc.e+off);
        const ey = cy + arc.r*Math.sin(arc.e+off);
        ax.beginPath(); ax.arc(ex, ey, 1.8, 0, Math.PI*2);
        ax.fillStyle = arc.gold ? "rgba(201,168,76,0.4)" : "rgba(130,110,255,0.3)";
        ax.fill();
      });
      // Crosshair
      ax.strokeStyle = "rgba(201,168,76,0.12)"; ax.lineWidth = 0.5;
      ax.beginPath(); ax.moveTo(cx-22,cy); ax.lineTo(cx+22,cy); ax.stroke();
      ax.beginPath(); ax.moveTo(cx,cy-22); ax.lineTo(cx,cy+22); ax.stroke();
      ax.beginPath(); ax.arc(cx,cy,7,0,Math.PI*2);
      ax.strokeStyle = "rgba(201,168,76,0.22)"; ax.stroke();
    };

    const loop = (ts: number) => {
      drawBg();
      drawArch(ts);
      // Beam
      if (!beamClock) beamClock = ts;
      const el = ts - beamClock;
      if (beamState === "idle" && el > 9000) {
        beamState="sweep"; beamY=0; beamOp=0; beamClock=ts;
      } else if (beamState === "sweep") {
        beamY += 0.48;
        beamOp = beamY<50 ? beamY/50 : beamY>H-50 ? (H-beamY)/50 : 1;
        const g = mx.createLinearGradient(0,0,W,0);
        g.addColorStop(0,   "rgba(255,255,255,0)");
        g.addColorStop(0.35,`rgba(255,255,255,${0.038*beamOp})`);
        g.addColorStop(0.5, `rgba(255,255,255,${0.062*beamOp})`);
        g.addColorStop(0.65,`rgba(255,255,255,${0.038*beamOp})`);
        g.addColorStop(1,   "rgba(255,255,255,0)");
        mx.clearRect(0,0,W,H);
        mx.fillStyle = g; mx.fillRect(0,beamY-1,W,2);
        if (beamY > H+10) { beamState="idle"; beamClock=ts; }
      }
      raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    raf = requestAnimationFrame(loop);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [initParticles]);

  const onMouseMove = (e: React.MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    mousePos.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    const px = ((mousePos.current.x / r.width)*100).toFixed(2);
    const py = ((mousePos.current.y / r.height)*100).toFixed(2);
    if (glowRef.current)
      glowRef.current.style.background =
        `radial-gradient(400px circle at ${px}% ${py}%, rgba(201,168,76,0.08) 0%, rgba(80,48,175,0.05) 45%, transparent 72%)`;
  };
  const onMouseLeave = () => {
    mousePos.current = { x: -9999, y: -9999 };
    if (glowRef.current) glowRef.current.style.background = "none";
  };

  return (
    <section
      ref={wrapRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <canvas ref={bgRef}   style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:1 }} />
      <canvas ref={beamRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:2 }} />
      <div ref={glowRef}    style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:3 }} />
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none", zIndex:4,
        background:"radial-gradient(ellipse 90% 90% at 50% 50%, transparent 35%, rgba(4,4,12,0.72) 100%)",
      }} />

      {/* Nav */}
      <header style={{
        position:"fixed", inset:"0 0 auto", zIndex:50,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"18px 52px",
        background: scrolled ? "rgba(4,4,12,0.92)" : "transparent",
        borderBottom: scrolled ? T.border : "0.5px solid transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        transition: "all 0.5s ease",
      }}>
        <span style={{ fontSize:"13px", fontWeight:500, color:"#fff", letterSpacing:"0.1em", textTransform:"uppercase" }}>
          Auron
        </span>
        <nav style={{ display:"flex", gap:"28px" }}>
          {["How it works","Infrastructure","Security"].map(l => (
            <a key={l} href="#" className="nav-a">{l}</a>
          ))}
        </nav>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{
            display:"flex", alignItems:"center", gap:"5px",
            fontSize:"10px", color:T.w24, letterSpacing:"0.05em",
            background:T.w04, border:T.border,
            borderRadius:"99px", padding:"4px 11px",
          }}>
            <span style={{ width:"4px", height:"4px", borderRadius:"50%", background:T.green, display:"inline-block", animation:"navpulse 2.4s infinite" }} />
            Live · Solana mainnet
          </div>
          <button style={{
            fontSize:"11px", fontWeight:500, padding:"7px 18px",
            background:T.w08, border:T.border,
            borderRadius:"6px", color:T.w90, cursor:"none",
            letterSpacing:"0.03em",
          }}>
            Sign in
          </button>
        </div>
      </header>

      {/* Body — two column */}
      <div style={{
        position:"relative", zIndex:10,
        flex:1, display:"grid", gridTemplateColumns:"1fr 420px",
        alignItems:"center", padding:"0 52px 64px", gap:"32px",
        paddingTop:"120px",
      }}>
        {/* LEFT */}
        <div>
          <Eyebrow gold>Programmable settlement infrastructure</Eyebrow>

          <div style={{ marginBottom:"28px" }}>
            <span style={{ display:"block", fontSize:"clamp(3rem,5vw,4.2rem)", fontWeight:300, letterSpacing:"-0.045em", lineHeight:1.02, color:T.w90 }}>
              Scan it.
            </span>
            <span style={{ display:"block", fontSize:"clamp(3rem,5vw,4.2rem)", fontWeight:500, letterSpacing:"-0.045em", lineHeight:1.02, color:T.w90 }}>
              Pay in{" "}
              <span style={{
                background:"linear-gradient(135deg,#c9a84c 0%,#e8cc7a 50%,#c9a84c 100%)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                backgroundClip:"text",
              }}>USDC.</span>
            </span>
            <span style={{ display:"block", fontSize:"clamp(3rem,5vw,4.2rem)", fontWeight:300, letterSpacing:"-0.045em", lineHeight:1.02, color:T.w18 }}>
              Merchant gets INR.
            </span>
          </div>

          <p style={{ fontSize:"14px", lineHeight:1.88, color:T.w32, maxWidth:"360px", marginBottom:"36px", letterSpacing:"0.01em" }}>
            Any UPI QR. Any merchant. Settled on Solana in under a second —
            no crypto knowledge required on either side.
          </p>

          <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"56px" }}>
            <button style={{ fontSize:"12px", fontWeight:500, padding:"10px 26px", background:"#fff", color:T.bg, border:"none", borderRadius:"6px", cursor:"none", letterSpacing:"0.03em" }}>
              Start for free
            </button>
            <button style={{ fontSize:"12px", color:T.w32, background:"none", border:"none", cursor:"none", letterSpacing:"0.02em" }}>
              View live stats →
            </button>
          </div>

          <div style={{ display:"flex", gap:0, borderTop:T.border, paddingTop:"28px" }}>
            {[
              { v:"~400ms",  l:"Settlement finality" },
              { v:"<$0.001", l:"Network fee"         },
              { v:"₹0",      l:"Merchant setup cost" },
            ].map(({ v, l }, i) => (
              <div key={l} style={{
                paddingRight:"28px", marginRight:"28px",
                borderRight: i < 2 ? T.border : "none",
              }}>
                <div style={{ fontSize:"22px", fontWeight:500, letterSpacing:"-0.035em", color:"#fff", marginBottom:"5px" }}>{v}</div>
                <div style={{ fontSize:"10px", color:T.w24, letterSpacing:"0.04em", textTransform:"uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — architectural panel */}
        <div style={{ position:"relative", height:"460px" }}>
          <canvas ref={archRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%" }} />
          {/* Pulse rings */}
          {[0,1,2].map(i => (
            <div key={i} style={{
              position:"absolute", top:"50%", left:"50%",
              width:`${180+i*80}px`, height:`${180+i*80}px`,
              borderRadius:"50%",
              border:`0.5px solid rgba(201,168,76,${0.09-i*0.025})`,
              animation:`pr ${4+i}s ease-in-out ${i*1.1}s infinite`,
              pointerEvents:"none",
            }} />
          ))}
          {/* Centre card */}
          <div style={{
            position:"absolute", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)",
            background:"rgba(5,4,14,0.90)",
            border:T.borderG, borderRadius:"10px",
            padding:"16px 18px", minWidth:"220px",
            backdropFilter:"blur(12px)",
          }}>
            <div style={{ fontSize:"9px", letterSpacing:"0.1em", textTransform:"uppercase", color:T.w24, marginBottom:"12px" }}>Latest settlement</div>
            {[
              ["Merchant","Swiggy · merchant@upi"],
              ["Amount","₹450 · 5.41 USDC"],
              ["Finality","412ms"],
              ["Fee","<$0.001"],
            ].map(([k,v],i) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom: i<3 ? "0.5px solid rgba(255,255,255,0.04)" : "none", gap:"16px" }}>
                <span style={{ fontSize:"11px", color:T.w24 }}>{k}</span>
                <span style={{ fontSize:"11px", fontFamily:"monospace", fontWeight:500, color: i===1 ? T.gold : i>=2 ? T.green : T.w45 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop:"10px", paddingTop:"8px", borderTop:"0.5px solid rgba(255,255,255,0.04)", fontSize:"9px", fontFamily:"monospace", color:T.w18, wordBreak:"break-all", lineHeight:1.5 }}>
              tx: a7f3c2e9b1d084...8f2c
            </div>
          </div>
          {/* Top card */}
          <div style={{
            position:"absolute", top:"12px", right:"0",
            background:"rgba(6,5,16,0.85)", border:T.border,
            borderRadius:"10px", padding:"12px 14px", minWidth:"186px",
            backdropFilter:"blur(12px)",
          }}>
            <div style={{ fontSize:"9px", letterSpacing:"0.1em", textTransform:"uppercase", color:T.w24, marginBottom:"10px" }}>System status</div>
            {[
              { l:"Settlement layer", ok:true  },
              { l:"Reconciliation",   ok:true  },
              { l:"Payout routing",   ok:true  },
              { l:"Audit ledger",     ok:false },
            ].map(({ l, ok }) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"6px" }}>
                <div style={{ width:"4px", height:"4px", borderRadius:"50%", background: ok ? T.green : T.gold, flexShrink:0 }} />
                <span style={{ fontSize:"10px", color:T.w32, flex:1 }}>{l}</span>
                <span style={{ fontSize:"10px", fontFamily:"monospace", color:T.w24 }}>{ok ? "Operational" : "Synced"}</span>
              </div>
            ))}
          </div>
          {/* Bottom card */}
          <div style={{
            position:"absolute", bottom:"12px", left:"0",
            background:"rgba(6,5,16,0.85)", border:T.border,
            borderRadius:"10px", padding:"12px 14px", minWidth:"168px",
            backdropFilter:"blur(12px)",
          }}>
            <div style={{ fontSize:"9px", letterSpacing:"0.1em", textTransform:"uppercase", color:T.w24, marginBottom:"10px" }}>Pipeline</div>
            {["QR parsed","Chain confirmed","INR credited","Ledger written"].map(l => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"0.5px solid rgba(255,255,255,0.04)", gap:"12px" }}>
                <span style={{ fontSize:"11px", color:T.w24 }}>{l}</span>
                <span style={{ fontSize:"11px", color:T.green, fontFamily:"monospace" }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Proof strip
// ─────────────────────────────────────────────
function ProofStrip() {
  return (
    <div style={{ borderTop:T.border, borderBottom:T.border, padding:"16px 52px", background:"rgba(255,255,255,0.012)", display:"flex", alignItems:"center", justifyContent:"center", flexWrap:"wrap" }}>
      {[
        "Idempotent pipeline","Async settlement queue","Reconciliation engine",
        "6-layer security","Append-only audit ledger","Phantom · Backpack · Solflare",
      ].map((item, i) => (
        <div key={item} style={{ display:"flex", alignItems:"center" }}>
          {i > 0 && <div style={{ width:"1px", height:"11px", background:T.w08, margin:"0 26px" }} />}
          <span style={{ fontSize:"11px", color:T.w24, letterSpacing:"0.02em" }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Pipeline — animated gold spine
// ─────────────────────────────────────────────
function PipelineSection() {
  const { ref, visible } = useInView(0.12);
  const steps = [
    { n:"01", title:"QR scan and VPA extraction",     sub:"Merchant UPI VPA and amount parsed from QR payload.",                      tag:"Instant",    c:T.green },
    { n:"02", title:"User confirmation",               sub:"Intent shown in plain language before any transaction executes.",          tag:"User action", c:T.w32  },
    { n:"03", title:"Phantom signing",                 sub:"User signs exactly what they see. Nothing executes without signature.",    tag:"User action", c:T.w32  },
    { n:"04", title:"On-chain USDC settlement",        sub:"USDC debited from wallet. Solana confirmation awaited.",                   tag:"~400ms",      c:T.green },
    { n:"05", title:"Conversion trigger",              sub:"Rate locked at confirmation. USDC converted to INR equivalent.",          tag:"Async",       c:T.gold  },
    { n:"06", title:"UPI payout to merchant VPA",      sub:"INR credited via aggregator. Payout confirmed, not just accepted.",       tag:"Async",       c:T.gold  },
    { n:"07", title:"Audit trail written",             sub:"On-chain hash · internal ID · timestamp. Immutable. Permanent.",         tag:"Permanent",   c:T.green },
  ];
  const totalH = steps.length * 76;

  return (
    <section ref={ref as any} style={{ padding:"140px 52px", background:T.bg, opacity: visible ? 1 : 0, transition:"opacity 0.6s ease" }}>
      <div style={{ maxWidth:"1000px", margin:"0 auto" }}>
        <SectionHead
          label="Settlement pipeline"
          title={<>Seven steps.<br />Zero visible to the user.</>}
          sub="Every payment moves through a verified, idempotent pipeline. Each step persists state before the next begins. Server restart at any point — the payment resumes, not drops."
        />
        <div style={{ position:"relative", paddingLeft:"48px" }}>
          {/* Static spine */}
          <div className="pipeline-line" style={{ height:`${totalH}px` }} />
          {/* Animated gold progress */}
          <div className="pipeline-progress" style={{ height:`${totalH}px`, transform: visible ? "scaleY(1)" : "scaleY(0)" }} />

          {steps.map((s, i) => (
            <div key={s.n} style={{
              display:"grid", gridTemplateColumns:"1fr auto",
              alignItems:"start", gap:"16px",
              padding:"18px 24px 18px 0", minHeight:"76px",
              borderBottom: i < steps.length-1 ? T.border : "none",
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateX(-8px)",
              transition: `opacity 0.5s ${0.1+i*0.09}s ease, transform 0.5s ${0.1+i*0.09}s ease`,
            }}>
              {/* Step dot on spine */}
              <div style={{ position:"absolute", left:"14px", width:"10px", height:"10px", borderRadius:"50%", background: visible ? T.gold : "rgba(255,255,255,0.1)", border:`1px solid ${visible ? T.gold : "rgba(255,255,255,0.1)"}`, marginTop:"6px", transition:`background 0.3s ${0.2+i*0.09}s ease`, zIndex:2 }} />
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px" }}>
                  <span style={{ fontSize:"10px", fontFamily:"monospace", color:T.w24 }}>{s.n}</span>
                  <span style={{ fontSize:"14px", fontWeight:500, color:T.w90 }}>{s.title}</span>
                </div>
                <div style={{ fontSize:"13px", color:T.w32, lineHeight:1.65 }}>{s.sub}</div>
              </div>
              <span style={{ fontSize:"10px", padding:"3px 10px", borderRadius:"99px", border:`0.5px solid ${s.c}`, color:s.c, whiteSpace:"nowrap", opacity:0.8, marginTop:"2px", letterSpacing:"0.03em" }}>
                {s.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Failure — tension typography
// ─────────────────────────────────────────────
function FailureSection() {
  const { ref, visible } = useInView(0.10);
  const failures = [
    { trigger:"Payout fails.",    response:"INR held in escrow. Retry with exponential backoff. The user's USDC is already final — the INR side must complete.", detail:[["Recovery","Auto-retry · escrow hold"],["User impact","None visible"]] },
    { trigger:"Network delay.",   response:"Confirmation listener has timeout and requeue. Assumes nothing until chain confirms. Missed confirmations caught by reconciliation.", detail:[["Recovery","Reconciliation · requeue"],["Window","< 10 minutes"]] },
    { trigger:"Price changes.",   response:"Rate locked at user confirmation. Auron absorbs slippage within a defined band. Outside band — held, user notified.", detail:[["Rate lock","At confirmation"],["Slippage band","Defined threshold"]] },
    { trigger:"Refund needed.",   response:"On-chain record provides indisputable proof of the original transaction. INR-side refunds routed through aggregator chargeback mechanism.", detail:[["Proof","On-chain hash"],["Resolution","Aggregator chargeback"]] },
  ];

  return (
    <section ref={ref as any} style={{ padding:"140px 52px", borderTop:T.border }}>
      <div style={{ maxWidth:"1000px", margin:"0 auto" }}>
        <SectionHead
          label="Failure system"
          title="Built for what goes wrong."
          sub="Financial infrastructure is judged by failure handling. Every failure mode has a defined, automatic recovery path. Nothing requires manual intervention."
        />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1px", background:"rgba(255,255,255,0.04)", borderRadius:T.radiusLg, overflow:"hidden" }}>
          {failures.map(({ trigger, response, detail }, idx) => (
            <div key={trigger} style={{
              padding:"44px 48px", background:T.bg,
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateY(16px)",
              transition:`opacity 0.6s ${idx*0.1}s ease, transform 0.6s ${idx*0.1}s ease`,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,168,76,0.018)")}
              onMouseLeave={e => (e.currentTarget.style.background = T.bg)}
            >
              {/* Large tension trigger word */}
              <h3 style={{
                fontSize:"clamp(1.8rem,3vw,2.6rem)", fontWeight:400,
                letterSpacing:"-0.04em", color:T.w90,
                marginBottom:"14px", lineHeight:1.08,
              }}>{trigger}</h3>
              {/* Small calm response */}
              <p style={{ fontSize:"13px", color:T.w32, lineHeight:1.78, marginBottom:"24px", maxWidth:"340px" }}>{response}</p>
              <div style={{ borderTop:T.border, paddingTop:"16px" }}>
                {detail.map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"0.5px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize:"11px", color:T.w24 }}>{k}</span>
                    <span style={{ fontSize:"10px", fontFamily:"monospace", color:T.w45 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Infrastructure
// ─────────────────────────────────────────────
function InfraSection() {
  const { ref, visible } = useInView(0.10);
  const cells = [
    { icon:"⬡", title:"Internal ledger",         desc:"Append-only. Every state transition recorded before execution continues. Source of truth for all settlement operations. Chain and DB can never silently diverge." },
    { icon:"↻", title:"Async settlement queue",   desc:"Payments processed asynchronously with retry-safe workers. Idempotent by design — the same payment triggered twice settles exactly once." },
    { icon:"◎", title:"Reconciliation engine",    desc:"Periodic worker detects chain-to-DB divergence. Stuck settlements detected, reset, and requeued within 10 minutes. No manual intervention." },
    { icon:"◈", title:"Risk and preflight",       desc:"Balance validation, network health, fee availability — all verified before any settlement executes. Failed preflight stops the payment before it starts." },
  ];

  return (
    <section ref={ref as any} style={{ padding:"140px 52px", borderTop:T.border, background:"rgba(201,168,76,0.012)" }}>
      <div style={{ maxWidth:"1000px", margin:"0 auto" }}>
        <SectionHead
          label="Infrastructure"
          title="Production-grade from the ground up."
          sub="Not a demo. The backend includes async queues, reconciliation workers, idempotency guarantees, and an append-only ledger. These are the things that make payments not lose money."
          gold
        />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1px", background:"rgba(255,255,255,0.04)", borderRadius:T.radiusLg, overflow:"hidden" }}>
          {cells.map(({ icon, title, desc }, i) => (
            <div key={title} style={{
              padding:"40px 44px", background:T.bg,
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateY(16px)",
              transition:`opacity 0.55s ${i*0.08}s ease, transform 0.55s ${i*0.08}s ease`,
            }}>
              <div style={{ fontSize:"18px", color:T.w18, marginBottom:"16px", fontFamily:"monospace" }}>{icon}</div>
              <div style={{ fontSize:"14px", fontWeight:500, color:T.w90, marginBottom:"10px" }}>{title}</div>
              <div style={{ fontSize:"13px", color:T.w32, lineHeight:1.78 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Statement — staggered cinematic reveal
// ─────────────────────────────────────────────
function StatementSection() {
  const { ref, visible } = useInView(0.20);
  const lines = [
    { text:"The blockchain is invisible.",     opacity:T.w90,  delay:0    },
    { text:"The settlement is programmable.",  opacity:T.w45,  delay:0.18 },
    { text:"The barrier is zero.",             opacity:T.w18,  delay:0.38 },
  ];

  return (
    <section ref={ref as any} style={{ padding:"140px 52px", borderTop:T.border, borderBottom:T.border }}>
      <div style={{ maxWidth:"1000px", margin:"0 auto", display:"flex", alignItems:"flex-start", gap:"80px" }}>
        <p style={{ fontSize:"10px", letterSpacing:"0.12em", textTransform:"uppercase", color:T.w24, paddingTop:"12px", minWidth:"90px" }}>
          The principle
        </p>
        <div>
          {lines.map(({ text, opacity, delay }) => (
            <div key={text} style={{ overflow:"hidden" }}>
              <p style={{
                fontSize:"clamp(2rem,4.2vw,3.8rem)", fontWeight:400,
                letterSpacing:"-0.045em", lineHeight:1.1, color:opacity,
                transform: visible ? "none" : "translateY(100%)",
                opacity: visible ? 1 : 0,
                transition:`transform 0.9s ${delay}s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ${delay}s ease`,
              }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Security
// ─────────────────────────────────────────────
function SecuritySection() {
  const { ref, visible } = useInView(0.10);
  const points = [
    { title:"No seed phrases",  desc:"Your Phantom wallet is your key. Losing your phone doesn't mean losing your money." },
    { title:"Intent mirror",    desc:"You see exactly what will happen — in plain language — before anything executes." },
    { title:"Scam detector",    desc:"Urgency in a message triggers automatic slowdown. Every scam uses urgency. We remove it." },
    { title:"Smart limits",     desc:"You set the ceiling for instant sends. Above it — extra confirmation required." },
    { title:"Closed signing",   desc:"Only Auron can prompt your wallet. No external site can trigger a transaction." },
    { title:"Daily spend cap",  desc:"A hard ceiling on daily spend. Even in the worst case, exposure is bounded." },
  ];

  return (
    <section ref={ref as any} id="security" style={{ padding:"140px 52px", borderTop:T.border }}>
      <div style={{ maxWidth:"1000px", margin:"0 auto", display:"grid", gridTemplateColumns:"320px 1fr", gap:"80px", alignItems:"start" }}>
        <div style={{ position:"sticky", top:"110px" }}>
          <SectionHead
            label="Security"
            title={<>Built for people who don't think about security.</>}
            sub="Most security tools assume you know what a seed phrase is. Ours assume you don't — and that's the harder design problem."
          />
          <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 16px", border:T.borderG, borderRadius:"8px", background:T.goldDim }}>
            <span style={{ fontSize:"16px", color:T.gold }}>◈</span>
            <div>
              <div style={{ fontSize:"13px", fontWeight:500, color:T.w90 }}>6 layers, every transaction</div>
              <div style={{ fontSize:"11px", color:T.w32, marginTop:"2px" }}>All six run before anything executes</div>
            </div>
          </div>
        </div>
        <div>
          {points.map((p, i) => (
            <div key={p.title} style={{
              display:"flex", gap:"18px",
              padding:"24px 0",
              borderBottom: i < points.length-1 ? T.border : "none",
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateX(12px)",
              transition:`opacity 0.5s ${i*0.07}s ease, transform 0.5s ${i*0.07}s ease`,
            }}>
              <div style={{ width:"20px", height:"20px", borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:T.goldDim, border:T.borderG, marginTop:"2px", fontSize:"10px", color:T.gold }}>✓</div>
              <div>
                <div style={{ fontSize:"14px", fontWeight:500, color:T.w90, marginBottom:"5px" }}>{p.title}</div>
                <div style={{ fontSize:"13px", color:T.w32, lineHeight:1.72 }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// CTA
// ─────────────────────────────────────────────
function CTASection() {
  const { ref, visible } = useInView(0.20);
  return (
    <section ref={ref as any} style={{ padding:"160px 52px", borderTop:T.border, background:"rgba(201,168,76,0.018)", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(ellipse 75% 65% at 50% 50%, rgba(201,168,76,0.055) 0%, transparent 65%)" }} />
      <div style={{ maxWidth:"620px", margin:"0 auto", textAlign:"center", position:"relative" }}>
        <div style={{ overflow:"hidden", marginBottom:"20px" }}>
          <h2 style={{
            fontSize:"clamp(2.4rem,4.8vw,3.8rem)", fontWeight:400,
            letterSpacing:"-0.045em", lineHeight:1.06, color:T.w90,
            transform: visible ? "none" : "translateY(80%)",
            transition:"transform 0.85s cubic-bezier(0.16,1,0.3,1)",
          }}>
            The settlement infrastructure<br />
            <span style={{ color:T.w24 }}>is invisible. The results are instant.</span>
          </h2>
        </div>
        <p style={{ fontSize:"14px", color:T.w32, lineHeight:1.85, marginBottom:"36px", opacity: visible ? 1 : 0, transition:"opacity 0.7s 0.2s ease" }}>
          Connect Phantom. Scan a QR. Done in under a second. Free to start.
        </p>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"14px", opacity: visible ? 1 : 0, transition:"opacity 0.7s 0.3s ease" }}>
          <button style={{ fontSize:"13px", fontWeight:500, padding:"12px 28px", background:"#fff", color:T.bg, border:"none", borderRadius:"6px", cursor:"none", letterSpacing:"0.03em" }}>
            Try the live demo
          </button>
          <button style={{ fontSize:"12px", color:T.w32, background:"none", border:"none", cursor:"none" }}>
            View infrastructure docs →
          </button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// Footer — sculptural close
// ─────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ borderTop:T.border, background:T.bg }}>
      {/* Large centred logo */}
      <div style={{
        padding:"80px 52px 48px",
        textAlign:"center",
        borderBottom:T.border,
      }}>
        <p style={{
          fontSize:"clamp(4rem,8vw,7rem)", fontWeight:300,
          letterSpacing:"0.12em", textTransform:"uppercase",
          color:"rgba(255,255,255,0.06)", lineHeight:1,
          marginBottom:"24px", userSelect:"none",
        }}>
          Auron
        </p>
        <p style={{ fontSize:"11px", color:T.w18, letterSpacing:"0.08em" }}>
          Programmable Settlement Infrastructure · Built on Solana · 2026
        </p>
      </div>
      {/* Thin meta bar */}
      <div style={{ padding:"20px 52px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
        <span style={{ fontSize:"11px", color:T.w18 }}>© 2026 Auron</span>
        <div style={{ display:"flex", gap:"24px" }}>
          {["Security","Live stats","GitHub","X"].map(l => (
            <a key={l} href="#" style={{ fontSize:"11px", color:T.w24, textDecoration:"none", letterSpacing:"0.02em" }}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}