import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "ink-navy": "#1B2430",
        parchment: "#EDE4CF",
        venetian: "#9B3A2E",
        "ledger-green": "#2F4A3C",
        ivory: "#FAF7EF",
        charcoal: "#262220",
      },
      fontFamily: {
        serif: ["Piazzolla", "Georgia", "serif"],
        mono: ["Space Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
