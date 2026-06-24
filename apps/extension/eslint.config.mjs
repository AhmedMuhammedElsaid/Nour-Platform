import react from "@repo/eslint-config/react.mjs";

export default [
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
