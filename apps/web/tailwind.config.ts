import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1B5E20", light: "#4C8C4A", dark: "#0D3D12" },
        earth: { DEFAULT: "#E0A800" },
      },
    },
  },
  plugins: [],
};

export default config;
