/**
 * Auron Icon Generator
 * Run: node scripts/generate-icons.mjs
 *
 * Generates all required Android mipmap icon sizes + web icons
 * from the master SVG at public/icon.svg using sharp.
 */

import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SVG  = path.join(ROOT, "public", "icon.svg");

// ─── Android mipmap sizes ─────────────────────────────────────────────────────
const ANDROID_SIZES = [
  { folder: "mipmap-mdpi",    size: 48  },
  { folder: "mipmap-hdpi",    size: 72  },
  { folder: "mipmap-xhdpi",   size: 96  },
  { folder: "mipmap-xxhdpi",  size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 },
];

// ─── Web / PWA sizes ──────────────────────────────────────────────────────────
const WEB_SIZES = [
  { name: "icon-192.png",  size: 192 },
  { name: "icon-512.png",  size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32  },
  { name: "favicon-16.png", size: 16  },
];

const ANDROID_RES = path.join(ROOT, "android", "app", "src", "main", "res");
const WEB_PUBLIC  = path.join(ROOT, "public");

async function run() {
  console.log("🎨 Generating Auron icons from SVG...\n");

  const svgBuffer = fs.readFileSync(SVG);

  // ── Android icons ────────────────────────────────────────────────────────
  for (const { folder, size } of ANDROID_SIZES) {
    const dir = path.join(ANDROID_RES, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Regular icon
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, "ic_launcher.png"));

    // Round icon (circular crop)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, "ic_launcher_round.png"));

    // Foreground layer for adaptive icons (same as main but no bg)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, "ic_launcher_foreground.png"));

    console.log(`  ✅ Android ${folder} (${size}x${size})`);
  }

  // ── Web / PWA icons ──────────────────────────────────────────────────────
  for (const { name, size } of WEB_SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(WEB_PUBLIC, name));
    console.log(`  ✅ Web ${name} (${size}x${size})`);
  }

  // ── favicon.ico (32x32 fallback) ─────────────────────────────────────────
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(WEB_PUBLIC, "favicon.ico"));
  console.log("  ✅ favicon.ico (32x32)");

  console.log("\n✨ All icons generated successfully!");
  console.log("   Android: android/app/src/main/res/mipmap-*/");
  console.log("   Web:     public/\n");
}

run().catch((err) => {
  console.error("❌ Icon generation failed:", err.message);
  process.exit(1);
});
