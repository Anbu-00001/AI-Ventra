import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#050508",
        surface: "#0A0A0F",
        "glass-border": "rgba(255,255,255,0.06)",
        crimson: {
          DEFAULT: "#C0182A",
          glow: "#FF1A3C",
          dark: "#8B0000",
        },
        amber: {
          DEFAULT: "#F59E0B",
          glow: "#FCD34D",
        },
        teal: {
          data: "#14B8A6",
        },
        pure: "#F8FAFC",
        muted: "#94A3B8",
        dim: "#475569",
      },
      fontFamily: {
        orbitron: ["Orbitron", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      letterSpacing: {
        hero: "-0.02em",
        wide: "0.2em",
        wider: "0.25em",
      },
      animation: {
        "scan-line": "scanLine 4s linear infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "float-up": "floatUp 6s ease-in-out infinite",
        "grid-scroll": "gridScroll 20s linear infinite",
        "ticker-scroll": "tickerScroll 30s linear infinite",
        "gradient-text": "gradientText 4s ease-in-out infinite",
        "ring-pulse": "ringPulse 2s ease-out infinite",
        "dot-pulse": "dotPulse 1.5s ease-in-out infinite",
        "data-stream": "dataStream 2s linear infinite",
      },
      keyframes: {
        scanLine: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.5", boxShadow: "0 0 20px rgba(192,24,42,0.3)" },
          "50%": { opacity: "1", boxShadow: "0 0 40px rgba(192,24,42,0.6)" },
        },
        floatUp: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        gridScroll: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 100%" },
        },
        tickerScroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        gradientText: {
          "0%, 100%": { color: "#F8FAFC" },
          "33%": { color: "#F59E0B" },
          "66%": { color: "#F8FAFC" },
        },
        ringPulse: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        dotPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        dataStream: {
          "0%": { strokeDashoffset: "1000" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      backgroundImage: {
        "hex-pattern":
          "url(\"data:image/svg+xml,%3Csvg width='28' height='49' viewBox='0 0 28 49' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
export default config;
