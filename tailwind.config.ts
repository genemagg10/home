import type { Config } from "tailwindcss";

// Palette mirrors the approved Style B "Homestead" mockup (mockups/style-b-homestead.html).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f6f1e7",
        card: "#fffdf8",
        ink: "#33302a",
        muted: "#8a8377",
        faint: "#b3aa99",
        line: "#e8e0d2",
        sage: { DEFAULT: "#7a8b6f", dark: "#5f6f55" },
        clay: { DEFAULT: "#c08552", dark: "#a96d3c" },
        rose: "#b8695f",
        gold: "#c9a24a",
        leaf: "#84a07c",
      },
      fontFamily: {
        serif: ["'Iowan Old Style'", "'Palatino Linotype'", "Georgia", "serif"],
        sans: ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 10px rgba(80,70,50,.05)",
      },
      borderRadius: {
        xl2: "18px",
      },
    },
  },
  plugins: [],
};

export default config;
