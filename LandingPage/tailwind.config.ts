import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "hud-bg": "#050510",
        "hud-panel": "rgba(5, 5, 20, 0.85)",
        "hud-cyan": "#00f0ff",
        "hud-purple": "#a855f7",
        "hud-red": "#ff3e3e",
        "hud-green": "#00ff88",
        "hud-yellow": "#ffd700",
        "hud-text": "#e0f0ff",
        "hud-dim": "rgba(160, 200, 240, 0.6)",
        "hud-border": "rgba(0, 240, 255, 0.12)",
        "discord-blurple": "#5865f2",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "glitch": "glitch 3s steps(1) infinite",
        "typing-blink": "typing-blink 1s steps(1) infinite",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
        "boot-flicker": "boot-flicker 4s infinite",
        "spin-slow": "spin 20s linear infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-15px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
