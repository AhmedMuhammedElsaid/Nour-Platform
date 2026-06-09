/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Semantic colors are CSS custom properties resolved at runtime by
      // lib/theme-context.tsx (NativeWind vars() helper). This lets the
      // ThemeProvider swap dark ↔ light by changing the CSS var values on the
      // root View — no component needs updating when the theme changes.
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        "text-2": "var(--color-text-2)",
        muted: "var(--color-muted)",
        primary: "var(--color-primary)",
        "primary-fg": "var(--color-primary-fg)",
        sun: "var(--color-sun)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        focus: "var(--color-focus)",
      },
      fontFamily: {
        display: ["Fraunces_400Regular", "System"],
        sans: ["Inter_400Regular", "System"],
        quran: ["AmiriQuran_400Regular", "System"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
      },
    },
  },
  plugins: [],
};
