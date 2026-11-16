/** @type {import('tailwindcss').Config} */
// Colours are CSS variables (see app/globals.css) so the app has light and dark themes.
// The chrome is deliberately neutral: the user's own brand colours are the only strong colour on screen.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

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
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Kept as an alias so older pages keep working; it is the same UI sans.
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        card: v("card"),
        border: v("border"),
        accent: {
          DEFAULT: v("accent"),
          light: v("accent-light"),
          fg: v("accent-fg"),
          glow: "rgb(var(--accent) / 0.06)",
        },
        success: v("success"),
        warn: v("warn"),
        error: v("error"),
        text: {
          DEFAULT: v("text"),
          muted: v("text-muted"),
        },
      },
      borderRadius: {
        xl: "10px",
        "2xl": "14px",
      },
      boxShadow: {
        // No glows: a single quiet elevation.
        accent: "0 1px 2px rgb(0 0 0 / 0.06)",
        glow: "0 1px 2px rgb(0 0 0 / 0.06)",
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)",
        pop: "0 8px 24px rgb(0 0 0 / 0.10)",
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "fade-up": "fadeUp 0.18s ease-out forwards",
        pulse: "pulse 1.4s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
