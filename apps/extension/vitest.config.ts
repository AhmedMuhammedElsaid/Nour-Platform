import { defineConfig } from "vitest/config";

export default defineConfig({
  // Build-time constants normally injected by vite.config.ts `define` — tests
  // importing modules that read them at module scope need them too.
  define: {
    __API_BASE_URL__: JSON.stringify("https://site.test"),
    __BROWSER__: JSON.stringify("chrome"),
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
