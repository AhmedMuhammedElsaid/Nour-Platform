import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import chromeManifest from "./src/manifest.config";
import firefoxManifest from "./src/manifest.firefox.config";

// Build-time API base URL — extension never imports @repo/config/env.
const API_BASE_URL =
  process.env.EXT_API_BASE_URL ?? "https://nour-platform-web.vercel.app";

// Vite mode selects the browser target: `--mode chrome` (default) or
// `--mode firefox`. The define constant is inlined and dead branches are
// tree-shaken, so each build contains only the relevant audio strategy.
export default defineConfig(({ mode }) => {
  const BROWSER = mode === "firefox" ? "firefox" : "chrome";

  return {
    plugins: [
      react(),
      tailwindcss(),
      crx({ manifest: BROWSER === "firefox" ? firefoxManifest : chromeManifest }),
    ],
    define: {
      __API_BASE_URL__: JSON.stringify(API_BASE_URL),
      __BROWSER__: JSON.stringify(BROWSER),
    },
    build: {
      outDir: `dist/${BROWSER}`,
      rollupOptions: {
        // The non-manifest HTML entry points: offscreen (Chrome) / player tab (Firefox).
      input: (
        BROWSER === "firefox"
          ? { player: "src/player/index.html" }
          : { offscreen: "src/offscreen/index.html" }
      ) as Record<string, string>,
      },
    },
  };
});
