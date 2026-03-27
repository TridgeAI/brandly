/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      colors: {
        bg: "#0A0A0F",
        surface: "#12121A",
        card: "#1A1A28",
        border: "#2A2A40",
        accent: {
          DEFAULT: "#7C6EF8",
          light: "#A89DF9",
          glow: "rgba(124,110,248,0.12)",
        },
        success: "#34D399",
        warn: "#FBBF24",
        error: "#F87171",
        text: {
          DEFAULT: "#E8E8F0",
          muted: "#6B6B8A",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        accent: "0 8px 24px rgba(124,110,248,0.25)",
        glow: "0 4px 20px var(--glow-color, rgba(124,110,248,0.3))",
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "fade-up": "fadeUp 0.45s ease forwards",
        pulse: "pulse 1.4s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
