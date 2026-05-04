/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // argon2 must run server-side only — keep it out of the client bundle
  serverExternalPackages: ["argon2"],

  // Polyfill stubs for optional wallet connector peer deps (Solana wallet adapters)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              // Solana RPC (Helius + devnet/mainnet), Jupiter API, Anthropic, Supabase
              "connect-src 'self' https://*.helius-rpc.com https://api.mainnet-beta.solana.com https://api.devnet.solana.com wss://*.helius-rpc.com wss://api.mainnet-beta.solana.com wss://api.devnet.solana.com https://api.jup.ag https://price.jup.ag https://api.anthropic.com https://*.supabase.co wss://*.supabase.co https://auron.vercel.app",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.auron.xyz" }],
        destination: "https://auron.xyz/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
