import { defineManifest } from "@crxjs/vite-plugin";

import pkg from "../package.json";

// Chrome MV3 manifest. CRXJS rewrites the TS/HTML entry paths to their built
// assets and generates dist/manifest.json. Firefox gets its own manifest in a
// later, additive phase (see chrome-extension.md §7.4).
export default defineManifest({
  manifest_version: 3,
  name: "Nour — نور",
  description:
    "Reliable desktop azan, prayer times, and Islamic audio from the Nour platform.",
  version: pkg.version,
  permissions: ["alarms", "notifications", "storage", "offscreen"],
  host_permissions: ["https://nour-platform-web.vercel.app/*"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  options_page: "src/options/index.html",
});
