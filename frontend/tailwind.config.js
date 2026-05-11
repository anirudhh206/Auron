/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand gold palette — matches CSS variables exactly
        gold: {
          DEFAULT: "#C9A84C",
          light:   "#E8C97A",
          dim:     "#A07830",
        },
        // Surface hierarchy
        surface: {
          base:     "#0A0A0F",
          DEFAULT:  "#12121A",
          elevated: "#1A1A26",
        },
        // Semantic
        success: "#1D9E75",
        error:   "#E24B4A",
      },
      fontFamily: {
        // Fix: was --font-inter, DM Sans is actually loaded
        sans:    ["var(--font-dm-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "Times New Roman", "serif"],
      },
      screens: {
        // Standard breakpoints + explicit xs for very small phones
        xs: "375px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      spacing: {
        // Safe area insets for mobile notch/home-bar
        safe: "env(safe-area-inset-bottom)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        gold:      "0 4px 24px rgba(201,168,76,0.35)",
        "gold-lg": "0 8px 48px rgba(201,168,76,0.45)",
        "gold-sm": "0 2px 12px rgba(201,168,76,0.2)",
        card:      "0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        // Re-expose for JIT access
        "fade-in":  { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in":  "fade-in 0.3s ease forwards",
        "slide-up": "slide-up 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
      },
    },
  },
  plugins: [],
};
