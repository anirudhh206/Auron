import withPWA from "next-pwa";

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
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval' https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              // Allow service workers (next-pwa / Workbox) and web workers
              "worker-src 'self' blob:",
              // Solana RPC (Helius + devnet/mainnet), Jupiter API, Anthropic, Supabase
              "connect-src 'self' https://*.helius-rpc.com https://api.mainnet-beta.solana.com https://api.devnet.solana.com wss://*.helius-rpc.com wss://api.mainnet-beta.solana.com wss://api.devnet.solana.com https://api.jup.ag https://price.jup.ag https://api.anthropic.com https://*.supabase.co wss://*.supabase.co https://auron-mocha.vercel.app",
              // Allow camera and microphone via media
              "media-src 'self' blob:",
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

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Disable inline eval in Workbox runtime to satisfy CSP
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      // Cache API routes with network-first strategy
      urlPattern: /^https:\/\/auron-mocha\.vercel\.app\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: { maxEntries: 50, maxAgeSeconds: 60 },
      },
    },
    {
      // Cache static assets (fonts, images, JS, CSS)
      urlPattern: /\.(?:js|css|woff2?|png|jpg|svg|ico)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Cache page navigations — app shell stays fast
      urlPattern: /^https:\/\/auron-mocha\.vercel\.app\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "page-cache",
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
  ],
})(nextConfig);
