import config from "@repo/eslint-config/base.mjs";
import globals from "globals";

export default [
  ...config,
  {
    ignores: [".expo/**"],
  },
  {
    // Metro/NativeWind/Tailwind require CommonJS config files (no ESM loader
    // support yet) — `require()` here is the documented integration shape.
    files: ["metro.config.js", "babel.config.js", "tailwind.config.js", "jest.config.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.test.{ts,tsx}", "__tests__/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
