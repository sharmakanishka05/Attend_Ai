import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        surface: "var(--surface)",
        subtle: "var(--bg-subtle)",
        border: {
          DEFAULT: "var(--border)",
          hover: "var(--border-hover)",
        },
        primary: {
          text: "var(--text)",
        },
        secondary: {
          text: "var(--muted)",
        },
        muted: {
          text: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--primary)",
          hover: "var(--color-accent-hover)",
          subtle: "var(--color-accent-subtle)",
        },
        success: {
          DEFAULT: "var(--success)",
          subtle: "var(--color-success-subtle)",
          border: "color-mix(in srgb, var(--success) 45%, transparent)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          subtle: "var(--color-warning-subtle)",
          border: "color-mix(in srgb, var(--warning) 45%, transparent)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          subtle: "var(--color-danger-subtle)",
          border: "color-mix(in srgb, var(--danger) 45%, transparent)",
        },
      },
      borderRadius: {
        control: "10px",
        card: "18px",
        dialog: "24px",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
