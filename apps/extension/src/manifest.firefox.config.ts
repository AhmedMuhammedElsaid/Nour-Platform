import { defineManifest } from "@crxjs/vite-plugin";

import pkg from "../package.json";

// Firefox MV3 manifest. Differences from Chrome:
//   • background.scripts (event page) — Firefox MV3 does not require a service
//     worker; an event page gives the background persistent heap between alarms,
//     useful for holding the player-tab ID without writing it to session storage
//     on every command.
//   • No "offscreen" permission — Firefox has no offscreen API; audio plays in a
//     managed player tab opened by the background (src/player/).
//   • Adds "tabs" permission — needed to create / query the player tab.
//   • browser_specific_settings — required for Firefox Add-on ID and min version;
//     115.0 is the minimum for browser.storage.session.
//
// The `background` field is typed for Chrome (service_worker); the cast is safe
// because CRXJS emits the object as-is into manifest.json and Firefox accepts it.
export default defineManifest({
  manifest_version: 3,
  name: "Nour — نور",
  description:
    "Reliable desktop azan, prayer times, and Islamic audio from the Nour platform.",
  version: pkg.version,
  icons: {
    "32": "icons/icon-32.png",
    "192": "icons/icon-192.png",
    "512": "icons/icon-512.png",
  },
  permissions: ["alarms", "notifications", "storage", "tabs", "geolocation"],
  host_permissions: ["https://nour-platform-web.vercel.app/*"],
  background: {
    scripts: ["src/background/index.ts"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
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
  // @ts-expect-error — browser_specific_settings is Firefox-only, not in CRXJS ManifestV3Export
  browser_specific_settings: {
    gecko: { id: "nour@nour-platform.com", strict_min_version: "115.0" },
  },
});
