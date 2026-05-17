import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#050705",
          900: "#080c0b",
          850: "#0d1210",
          800: "#121816",
          700: "#1d2722"
        },
        signal: {
          green: "#4dff88",
          cyan: "#4ad8ff",
          amber: "#f6c65b",
          red: "#ff5f73",
          violet: "#a78bfa"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Arial", "sans-serif"]
      },
      boxShadow: {
        terminal: "0 30px 90px rgba(0, 0, 0, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
