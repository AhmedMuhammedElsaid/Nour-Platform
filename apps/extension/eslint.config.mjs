import react from "@repo/eslint-config/react.mjs";

export default [
  // CRXJS generates jiti-compiled `vite.config.ts.timestamp-*.mjs` files
  // during the build; ignore them so ESLint doesn't race with the build
  // cleanup and throw ENOENT.
  { ignores: ["*.timestamp-*.mjs", "vite.config.ts"] },
  ...react,
  {
    // Background service worker + offscreen document run in the extension
    // context; chrome.* is typed by @types/chrome. Mark it a known global so
    // any non-type-aware lint pass doesn't flag it.
    languageOptions: {
      globals: { chrome: "readonly" },
    },
  },
];
