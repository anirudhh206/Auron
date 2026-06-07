'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BlinkAction {
  label: string;
  href: string;
}

interface BlinkMetadata {
  icon: string;
  label: string;
  title: string;
  description: string;
  links: { actions: BlinkAction[] };
}

// ─── Demo scenarios ───────────────────────────────────────────────────────────
const DEMO_BLINKS = [
  {
    label: 'Merchant Checkout',
    url: '/api/actions/pay?to=merch@upi&amount=2499&currency=INR&note=Solana+Hoodie',
    context: '@SolanaMerchStore',
    tweet: '🛍️ Just launched: Solana Hoodies. Pay directly with USDC — no crypto knowledge needed.',
    amount: '₹2,499',
    note: 'Solana Hoodie',
  },
  {
    label: 'Pay Link',
    url: '/api/actions/pay?to=demo@upi&amount=500&currency=INR&note=Lunch',
    context: '@anirudhh',
    tweet: 'hey @priya split the lunch — ₹500 your share.',
    amount: '₹500',
    note: 'Lunch split',
  },
  {
    label: 'Cross-Border',
    url: '/api/actions/pay?to=freelancer@upi&amount=5000&currency=INR&note=Invoice+%231',
    context: '@StartupFounder',
    tweet: 'Paying our India contractor Invoice #1 via Auron — stablecoin out, INR in, done in 30s 🇮🇳',
    amount: '₹5,000',
    note: 'Invoice #1',
  },
];

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:      '#08080A',
  s1:      '#0F0F12',
  s2:      '#161619',
  s3:      '#1C1C20',
  border:  '#26262A',
  borderB: '#3A3A3F',
  text:    '#F5F5F0',
  muted:   '#9A9AA8',
  dim:     '#606068',
  lime:    '#C8F135',
  gold:    '#F5A623',
  usdc:    '#2775CA',
  error:   '#EF4444',
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .blinks-root {
    min-height: 100dvh;
    background: ${C.bg};
    color: ${C.text};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow-x: hidden;
  }

  /* Dot grid */
  .blinks-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: radial-gradient(circle, ${C.border} 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.2;
    pointer-events: none;
    z-index: 0;
  }

  /* Lime top glow */
  .blinks-root::after {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 360px;
    background: radial-gradient(ellipse 60% 45% at 50% 0%, rgba(200,241,53,0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .blinks-content {
    position: relative;
    z-index: 1;
    max-width: 720px;
    margin: 0 auto;
    padding: 0 24px 80px;
  }

  /* Header */
  .blinks-header {
    padding: 48px 0 40px;
  }

  .blinks-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .blinks-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 100px;
    background: rgba(200,241,53,0.06);
    border: 1px solid rgba(200,241,53,0.18);
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    color: ${C.lime};
    letter-spacing: 0.1em;
  }

  .blinks-badge-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: ${C.lime};
    animation: livePulse 2s ease-in-out infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .blinks-title {
    font-family: 'Instrument Serif', serif;
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 400;
    color: ${C.text};
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin-bottom: 16px;
  }

  .blinks-subtitle {
    font-family: 'Geist Mono', monospace;
    font-size: 13px;
    color: ${C.dim};
    line-height: 1.7;
    max-width: 520px;
  }

  /* Demo selector */
  .blinks-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 32px;
    flex-wrap: wrap;
  }

  .blinks-tab {
    padding: 8px 16px;
    border-radius: 100px;
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid ${C.border};
    background: ${C.s1};
    color: ${C.dim};
  }

  .blinks-tab:hover {
    border-color: ${C.borderB};
    color: ${C.muted};
  }

  .blinks-tab-active {
    background: rgba(200,241,53,0.08);
    border-color: rgba(200,241,53,0.25);
    color: ${C.lime};
  }

  /* X/Twitter simulation */
  .x-card {
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 16px;
  }

  /* Tweet header */
  .tweet-header {
    padding: 16px 18px;
    border-bottom: 0.5px solid ${C.border};
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .tweet-avatar {
    width: 38px; height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, ${C.lime} 0%, rgba(200,241,53,0.3) 100%);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #0A0A08;
  }

  .tweet-handle {
    font-family: 'Geist Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    color: ${C.text};
    margin-bottom: 4px;
  }

  .tweet-text {
    font-size: 14px;
    color: ${C.muted};
    line-height: 1.6;
  }

  .tweet-action-url {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    background: ${C.s2};
    border: 1px solid ${C.border};
    border-radius: 6px;
    padding: 3px 8px;
  }

  .tweet-action-label {
    color: ${C.lime};
    font-weight: 600;
  }

  /* Blinks card */
  .blinks-card {
    overflow: hidden;
  }

  /* Card hero */
  .blinks-card-hero {
    height: 120px;
    background: linear-gradient(135deg, rgba(200,241,53,0.04) 0%, rgba(39,117,202,0.04) 100%);
    border-bottom: 0.5px solid ${C.border};
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  /* Decorative grid lines in hero */
  .blinks-card-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(200,241,53,0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(200,241,53,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .blinks-card-body {
    padding: 18px;
  }

  .blinks-card-title {
    font-family: 'Instrument Serif', serif;
    font-size: 18px;
    color: ${C.text};
    margin-bottom: 4px;
  }

  .blinks-card-desc {
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: ${C.dim};
    margin-bottom: 16px;
    line-height: 1.5;
  }

  /* Amount display */
  .blinks-amount-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    border-radius: 10px;
    margin-bottom: 14px;
  }

  /* Pay button */
  .blinks-pay-btn {
    width: 100%;
    padding: 14px;
    border-radius: 10px;
    background: ${C.lime};
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #0A0A08;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, transform 0.1s;
  }
  .blinks-pay-btn:hover { background: #A3C42A; }
  .blinks-pay-btn:active { transform: scale(0.99); }
  .blinks-pay-btn:disabled {
    background: ${C.s2};
    border: 1px solid ${C.border};
    color: ${C.dim};
    cursor: not-allowed;
  }

  /* Success state */
  .blinks-success {
    padding: 32px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }

  .blinks-success-ring {
    width: 56px; height: 56px;
    border-radius: 50%;
    background: rgba(200,241,53,0.08);
    border: 1px solid rgba(200,241,53,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .blinks-success-pulse {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1px solid rgba(200,241,53,0.15);
    animation: successPulse 2s ease-out infinite;
  }

  @keyframes successPulse {
    0%   { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.3); opacity: 0; }
  }

  .blinks-settling-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 100px;
    background: rgba(200,241,53,0.06);
    border: 1px solid rgba(200,241,53,0.15);
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.lime};
    letter-spacing: 0.06em;
  }

  /* Powered by footer */
  .blinks-powered {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 0.5px solid ${C.border};
  }

  /* How it works strip */
  .blinks-info {
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 12px;
    padding: 16px 18px;
    margin-bottom: 48px;
  }

  /* Explainer cards */
  .blinks-explainer {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 32px;
  }

  .explainer-card {
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 12px;
    padding: 18px 16px;
    transition: border-color 0.15s;
  }
  .explainer-card:hover { border-color: ${C.borderB}; }

  .explainer-number {
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: ${C.lime};
    letter-spacing: 0.1em;
    margin-bottom: 10px;
  }

  .explainer-title {
    font-size: 13px;
    font-weight: 600;
    color: ${C.text};
    margin-bottom: 6px;
  }

  .explainer-desc {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    line-height: 1.6;
  }

  /* Loading spinner */
  .blinks-spinner {
    width: 18px; height: 18px;
    border: 2px solid ${C.border};
    border-top-color: ${C.lime};
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* Footer */
  .blinks-footer {
    border-top: 0.5px solid ${C.border};
    padding-top: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  @media (max-width: 600px) {
    .blinks-explainer { grid-template-columns: 1fr; }
    .blinks-selector { gap: 6px; }
  }
`;

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ padding: '24px 18px', display: 'flex', justifyContent: 'center' }}>
      <div className="blinks-spinner" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BlinkPage() {
  const [selectedDemo, setSelectedDemo] = useState(0);
  const [metadata, setMetadata]         = useState<BlinkMetadata | null>(null);
  const [loading, setLoading]           = useState(true);
  const [paying, setPaying]             = useState(false);
  const [paid, setPaid]                 = useState(false);

  const demo = DEMO_BLINKS[selectedDemo];

  useEffect(() => {
    setLoading(true);
    setPaid(false);
    setPaying(false);
    fetch(demo.url)
      .then(r => r.json())
      .then((data: BlinkMetadata) => { setMetadata(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedDemo, demo.url]);

  async function handlePay() {
    setPaying(true);
    await new Promise(r => setTimeout(r, 2000));
    setPaying(false);
    setPaid(true);
  }

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay },
  });

  return (
    <>
      <style>{STYLES}</style>
      <div className="blinks-root">
        <div className="blinks-content">

          {/* ── Header ── */}
          <motion.div {...fadeUp(0)} className="blinks-header">
            <div className="blinks-eyebrow">
              <span className="blinks-badge">
                <span className="blinks-badge-dot" />
                SOLANA ACTIONS SPEC
              </span>
            </div>
            <h1 className="blinks-title">
              Pay anyone in India.<br />
              From any surface.
            </h1>
            <p className="blinks-subtitle">
              Every Auron pay link is a composable on-chain action — operational inside X, Phantom, and Dialect. Paste a link. It becomes a payment. No redirect. No app install.
            </p>
          </motion.div>

          {/* ── Demo selector ── */}
          <motion.div {...fadeUp(0.08)} className="blinks-selector">
            {DEMO_BLINKS.map((d, i) => (
              <button
                key={i}
                onClick={() => setSelectedDemo(i)}
                className={`blinks-tab ${selectedDemo === i ? 'blinks-tab-active' : ''}`}
              >
                {d.label.toUpperCase()}
              </button>
            ))}
          </motion.div>

          {/* ── X/Twitter simulation ── */}
          <motion.div {...fadeUp(0.12)} className="x-card">

            {/* Tweet */}
            <div className="tweet-header">
              <div className="tweet-avatar">
                {demo.context.replace('@', '')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tweet-handle">{demo.context}</div>
                <p className="tweet-text">{demo.tweet}</p>
                <div className="tweet-action-url">
                  <span className="tweet-action-label">solana-action:</span>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
                    auron-mocha.vercel.app/api/actions/pay
                  </span>
                </div>
              </div>
            </div>

            {/* Blinks card */}
            <div className="blinks-card">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <LoadingSkeleton />
                  </motion.div>

                ) : paid ? (
                  <motion.div
                    key="paid"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="blinks-success"
                  >
                    <div className="blinks-success-ring">
                      <div className="blinks-success-pulse" />
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                      >
                        <CheckCircle2 size={26} color={C.lime} />
                      </motion.div>
                    </div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                        Payment signed
                      </p>
                      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim }}>
                        {demo.amount} settling to UPI via Auron
                      </p>
                    </div>
                    <div className="blinks-settling-badge">
                      <Clock size={11} />
                      Settlement in progress · UTR incoming
                    </div>
                  </motion.div>

                ) : metadata ? (
                  <motion.div
                    key="card"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Hero */}
                    <div className="blinks-card-hero">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={metadata.icon}
                        alt="Auron"
                        style={{ width: 52, height: 52, borderRadius: 12, position: 'relative', zIndex: 1, border: `1px solid ${C.border}` }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>

                    {/* Body */}
                    <div className="blinks-card-body">
                      <h3 className="blinks-card-title">{metadata.title}</h3>
                      <p className="blinks-card-desc">{metadata.description}</p>

                      {/* Amount row */}
                      <div className="blinks-amount-row">
                        <div>
                          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.dim, letterSpacing: '0.12em', marginBottom: 4 }}>
                            AMOUNT
                          </p>
                          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 20, fontWeight: 500, color: C.gold, letterSpacing: '-0.02em' }}>
                            {demo.amount}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.dim, letterSpacing: '0.12em', marginBottom: 4 }}>
                            NOTE
                          </p>
                          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.muted }}>
                            {demo.note}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {metadata.links.actions.map((action, i) => (
                        <button
                          key={i}
                          className="blinks-pay-btn"
                          onClick={handlePay}
                          disabled={paying}
                        >
                          {paying ? (
                            <>
                              <div className="blinks-spinner" style={{ borderTopColor: C.dim, width: 14, height: 14, borderWidth: 1.5 }} />
                              Signing with Phantom...
                            </>
                          ) : (
                            <>
                              {action.label}
                              <ArrowRight size={14} />
                            </>
                          )}
                        </button>
                      ))}

                      {/* Powered by */}
                      <div className="blinks-powered">
                        <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
                          Powered by{' '}
                          <a href="https://auron-mocha.vercel.app" target="_blank" rel="noopener noreferrer"
                            style={{ color: C.lime, textDecoration: 'none' }}>
                            Auron
                          </a>
                          {' '}· Solana Actions
                        </span>
                        <ExternalLink size={11} color={C.dim} />
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── How it works ── */}
          <motion.div {...fadeUp(0.16)} className="blinks-info">
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: '0.12em', marginBottom: 8 }}>
              HOW THIS WORKS
            </p>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
              The URL{' '}
              <code style={{ background: C.s2, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>
                auron-mocha.vercel.app/api/actions/pay
              </code>
              {' '}returns action metadata per the Solana Actions spec. In X, Phantom, and Dialect, this renders natively as an interactive card — no redirect, no app install required. Once registered with the Dialect registry, this card appears inline anywhere the URL is pasted.
            </p>
          </motion.div>

          {/* ── Explainer cards ── */}
          <motion.div {...fadeUp(0.2)} className="blinks-explainer">
            {[
              { n: '01', title: 'Paste anywhere', desc: 'Drop an Auron pay link in a tweet, Discord message, or website. It becomes an interactive payment card.' },
              { n: '02', title: 'Sign with Phantom', desc: 'User signs a USDC transfer in one click. No redirect. No app install. 400ms on Solana.' },
              { n: '03', title: 'Merchant gets INR', desc: 'Auron settles to the merchant\'s UPI account in under 30 seconds. The blockchain is invisible.' },
            ].map((card) => (
              <div key={card.n} className="explainer-card">
                <p className="explainer-number">{card.n}</p>
                <p className="explainer-title">{card.title}</p>
                <p className="explainer-desc">{card.desc}</p>
              </div>
            ))}
          </motion.div>

          {/* ── Footer ── */}
          <motion.div {...fadeUp(0.24)} className="blinks-footer" style={{ marginTop: 48 }}>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim }}>
              Auron · Programmable settlement layer above UPI
            </span>
            <a
              href="https://auron-mocha.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.lime)}
              onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
            >
              auron-mocha.vercel.app <ExternalLink size={10} />
            </a>
          </motion.div>

        </div>
      </div>
    </>
  );
}