/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Verbatim from packages/ui/src/styles/tokens.css (CLAUDE.md §3.1 / plan §3.1).
      // Dark values are the defaults; `dark:` variants below carry the light theme
      // — NativeWind's `darkMode: "class"` toggles on the root `dark` class, so we
      // invert the usual pairing (base = dark token, `dark:` = light token) to keep
      // the app's default (dark) palette as the bare utility.
      colors: {
        bg: "#0f0d0a",
        surface: "#1c1915",
        "surface-2": "#252018",
        border: "rgb(200 160 80 / 0.15)",
        text: "#f0e6cc",
        "text-2": "#8a7a62",
        muted: "#5a4a38",
        primary: "#c8a050",
        "primary-fg": "#0f0d0a",
        sun: "#e4c57e",
        secondary: "#0e6e59",
        accent: "#c6a266",
        success: "#48b57c",
        warning: "#e0a14a",
        danger: "#e26a63",
        focus: "#c8a050",
        // Light-theme counterparts — referenced explicitly (e.g. `bg-light-bg`)
        // by the theme provider when `colorScheme === "light"".
        "light-bg": "#fdfaf4",
        "light-surface": "#ffffff",
        "light-surface-2": "#f4f1e8",
        "light-border": "#e6e2d7",
        "light-text": "#13201a",
        "light-text-2": "#3f4a44",
        "light-muted": "#6b7670",
        "light-primary": "#9a7830",
        "light-primary-fg": "#ffffff",
        "light-sun": "#c8a050",
        "light-secondary": "#0e6e59",
        "light-accent": "#a8884a",
        "light-success": "#147d4a",
        "light-warning": "#a66400",
        "light-danger": "#b3261e",
        "light-focus": "#9a7830",
      },
      fontFamily: {
        display: ["Fraunces"],
        sans: ["Inter"],
        quran: ["Amiri Quran"],
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
