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
  // Packaged brand icons: shown in chrome://extensions, the toolbar, and as the
  // notification iconUrl (via chrome.runtime.getURL).
  icons: {
    "32": "icons/icon-32.png",
    "192": "icons/icon-192.png",
    "512": "icons/icon-512.png",
  },
  permissions: ["alarms", "notifications", "storage", "offscreen"],
  host_permissions: ["https://nour-platform-web.vercel.app/*"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  options_page: "src/options/index.html",
  chrome_url_overrides: {
    newtab: "src/newtab/index.html",
  },
  action: {
    default_title: "نور",
    default_popup: "src/popup/index.html",
    default_icon: {
      "32": "icons/icon-32.png",
    },
  },
});
