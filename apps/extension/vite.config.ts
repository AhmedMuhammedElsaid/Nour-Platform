import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import manifest from "./src/manifest.config";

// Build-time API base URL. Mirrors how the mobile app reads EXPO_PUBLIC_* —
// the extension never imports @repo/config/env (that barrel is Node/server-only
// and validates server secrets). Override with EXT_API_BASE_URL for dev.
const API_BASE_URL =
  process.env.EXT_API_BASE_URL ?? "https://nour-platform-web.vercel.app";

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  define: {
    __API_BASE_URL__: JSON.stringify(API_BASE_URL),
  },
});
