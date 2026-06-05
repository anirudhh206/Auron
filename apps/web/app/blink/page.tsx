'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Zap, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

// ── Blinks action metadata ─────────────────────────────────────────────────

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

// ── Demo scenarios ─────────────────────────────────────────────────────────

const DEMO_BLINKS = [
  {
    label: 'Merchant Checkout',
    url: '/api/actions/pay?to=merch@upi&amount=2499&currency=INR&note=Solana+Hoodie',
    context: 'Tweet by @SolanaMerchStore',
    tweet: '🛍️ Just launched: Solana Hoodies! Pay directly with USDC — no crypto knowledge needed. Click below 👇',
  },
  {
    label: 'Pay Link',
    url: '/api/actions/pay?to=demo@upi&amount=500&currency=INR&note=Lunch',
    context: 'Tweet by @anirudhh',
    tweet: 'hey @priya split the lunch — ₹500 your share, pay here 👇',
  },
  {
    label: 'Cross-Border',
    url: '/api/actions/pay?to=freelancer@upi&amount=5000&currency=INR&note=Invoice+%231',
    context: 'Tweet by @StartupFounder',
    tweet: 'Paying our India contractor Invoice #1 via Auron — stablecoin out, INR in, done in 30s 🇮🇳',
  },
];

// ── Main page ──────────────────────────────────────────────────────────────

export default function BlinkPage() {
  const [selectedDemo, setSelectedDemo] = useState(0);
  const [metadata, setMetadata] = useState<BlinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const currentDemo = DEMO_BLINKS[selectedDemo];

  // Fetch Blinks metadata from our own action endpoint
  useEffect(() => {
    setLoading(true);
    setPaid(false);
    setPaying(false);

    fetch(currentDemo.url)
      .then(r => r.json())
      .then((data: BlinkMetadata) => {
        setMetadata(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedDemo, currentDemo.url]);

  // Simulate payment for demo purposes
  async function handlePay() {
    setPaying(true);
    await new Promise(r => setTimeout(r, 2000));
    setPaying(false);
    setPaid(true);
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center px-4 py-12">

      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={18} className="text-[#9945FF]" />
          <span className="text-sm text-gray-400">Solana Blinks — Auron Payment Actions</span>
        </div>
        <h1 className="text-2xl font-bold">Live Blinks Preview</h1>
        <p className="text-gray-400 text-sm mt-1">
          This is what Auron payment links look like when embedded in X, Phantom, or any Blinks-aware platform.
        </p>
      </div>

      {/* Demo selector */}
      <div className="w-full max-w-2xl flex gap-2 mb-6">
        {DEMO_BLINKS.map((demo, i) => (
          <button
            key={i}
            onClick={() => setSelectedDemo(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedDemo === i
                ? 'bg-[#9945FF] text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {demo.label}
          </button>
        ))}
      </div>

      {/* X/Twitter card simulation */}
      <div className="w-full max-w-2xl">
        <div className="bg-[#0F0F0F] border border-white/10 rounded-2xl overflow-hidden">

          {/* Fake tweet */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{currentDemo.context.split('by ')[1]}</span>
                  <span className="text-xs text-gray-500">{currentDemo.context.split('by ')[0].trim()}</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{currentDemo.tweet}</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-xs text-[#9945FF] font-medium">solana-action:</span>
                  <span className="text-xs text-gray-500 truncate max-w-[200px]">
                    auron-mocha.vercel.app{currentDemo.url.split('?')[0]}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Blinks card */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 flex items-center justify-center"
              >
                <div className="w-5 h-5 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
              </motion.div>
            ) : paid ? (
              <motion.div
                key="paid"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 flex flex-col items-center gap-3"
              >
                <CheckCircle2 size={40} className="text-[#14F195]" />
                <p className="text-lg font-semibold">Payment sent</p>
                <p className="text-sm text-gray-400">Settling to UPI — UTR will appear shortly</p>
                <div className="flex items-center gap-2 text-xs text-[#14F195] bg-[#14F195]/10 px-3 py-1.5 rounded-full">
                  <Clock size={12} />
                  Settlement in progress via Auron
                </div>
              </motion.div>
            ) : metadata ? (
              <motion.div
                key="card"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Action icon + title */}
                <div className="relative">
                  <div className="w-full h-36 bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/10 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={metadata.icon}
                      alt="Auron"
                      className="w-16 h-16 rounded-2xl shadow-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-base">{metadata.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{metadata.description}</p>

                  {/* Action buttons */}
                  <div className="mt-4 flex flex-col gap-2">
                    {metadata.links.actions.map((action, i) => (
                      <motion.button
                        key={i}
                        onClick={handlePay}
                        disabled={paying}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full bg-[#9945FF] hover:bg-[#8A3DEE] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        {paying ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Signing with Phantom...
                          </>
                        ) : (
                          <>
                            {action.label}
                            <ArrowRight size={14} />
                          </>
                        )}
                      </motion.button>
                    ))}
                  </div>

                  {/* Powered by */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                      Powered by{' '}
                      <a
                        href="https://auron-mocha.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#9945FF] hover:underline"
                      >
                        Auron
                      </a>
                      {' '}· Solana Actions
                    </span>
                    <ExternalLink size={12} className="text-gray-600" />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Info strip */}
        <div className="mt-4 bg-white/3 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="text-[#9945FF] font-medium">How this works:</span> The Blinks URL
            {' '}<code className="bg-white/5 px-1 rounded text-[10px]">auron-mocha.vercel.app/api/actions/pay</code>{' '}
            returns action metadata via the Solana Actions spec. In X/Twitter, Phantom, and Dialect,
            this renders natively as an interactive card — no redirect, no app install.
            Once registered with the Dialect registry, this card appears inline anywhere the URL is pasted.
          </p>
        </div>
      </div>
    </div>
  );
}
