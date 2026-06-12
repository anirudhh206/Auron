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
const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://auron.vercel.app';
const isLocalDev = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'xyz.auron.app',
  appName: 'Auron',
  webDir: 'out', // Fallback — not used when server.url is set

  server: {
    url: serverUrl, // set CAPACITOR_SERVER_URL=http://10.0.2.2:3000 for emulator dev
    cleartext: isLocalDev, // needed for http:// local dev server
    androidScheme: 'https',
  },

  android: {
    backgroundColor: '#030712',
    allowMixedContent: isLocalDev,
    captureInput: true,
    webContentsDebuggingEnabled: isLocalDev,
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
