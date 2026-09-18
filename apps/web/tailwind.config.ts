import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Deep paddy-leaf black-green, used for body text instead of a
        // tinted grey-black — keeps the whole palette rooted in "plant".
        ink: { DEFAULT: "#1C2B1E", soft: "#4A5A4C" },
        // Rice-husk paper, warmer/more olive than a generic cream.
        paper: { DEFAULT: "#F4EFDE", raised: "#FBF8EE" },
        line: "#DCD3B8",
        // Paddy leaf green (was a flatter Material green before).
        primary: { DEFAULT: "#2F6B3D", light: "#5B9A5E", dark: "#1E4A28", 50: "#EAF2E7" },
        // Turmeric — a real crop, not a generic "amber" accent.
        earth: { DEFAULT: "#C97F17", dark: "#8F5C10", 50: "#FBF0DC" },
        // Monsoon sky — used for links/info, keeps blue out of the brand green.
        monsoon: { DEFAULT: "#315B7D", dark: "#22435E", 50: "#E8EFF4" },
        // Chili — warmer than pure red for errors/alerts.
        chili: { DEFAULT: "#A6432E", dark: "#7C3222", 50: "#F7E6E1" },
      },
      fontFamily: {
        // Fraunces for headings — a warm, slightly rustic serif with
        // character, instead of reusing the UI sans at a bigger size.
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Per-script UI faces so Sinhala/Tamil render in a typeface built
        // for that script rather than falling back to the OS default.
        si: ["var(--font-sinhala)", "var(--font-sans)", "sans-serif"],
        ta: ["var(--font-tamil)", "var(--font-sans)", "sans-serif"],
      },
      maxWidth: {
        content: "68rem",
      },
    },
  },
  plugins: [],
};

export default config;