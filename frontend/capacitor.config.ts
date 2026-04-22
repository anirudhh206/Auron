import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Auron Capacitor Config
 *
 * Architecture:
 * - Web: Next.js runs on Vercel normally (full server-side + API routes)
 * - APK: Capacitor WebView loads the SAME Vercel URL — no static export needed
 *        All API routes, KV rate limiting, argon2 hashing work exactly as web
 *        Native plugins (biometrics, push, vibration) layer on top
 *
 * Update `server.url` after Vercel deployment.
 */
const config: CapacitorConfig = {
  appId: 'xyz.auron.app',
  appName: 'Auron',
  webDir: 'out', // Fallback — not used when server.url is set

  server: {
    url: 'https://auron.vercel.app', // TODO: replace with actual Vercel URL after deploy
    cleartext: false,
    androidScheme: 'https',
  },

  android: {
    backgroundColor: '#030712',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // set true for dev builds
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#030712',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      fadeInDuration: 300,
      fadeOutDuration: 300,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#030712',
      overlaysWebView: false,
    },
  },
};

export default config;
