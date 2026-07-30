import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the PWA manifest against regressions that would break installability
// (Chromium needs name, start_url, a 192/512-or-"any" icon, and a display mode).
describe("web app manifest", () => {
  // vitest runs with the package (apps/web) as cwd.
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf8"),
  ) as {
    name?: string;
    start_url?: string;
    display?: string;
    icons?: Array<{ src: string; sizes: string; purpose?: string }>;
  };

  it("declares the fields required for install", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe("/ar");
    expect(manifest.display).toBe("standalone");
  });

  // The brand mark is a photographic Quran scene, so there is deliberately no
  // scalable sizes:"any" vector any more (the old ن SVG was the only one, and a
  // photo cannot be meaningfully vectorised). Chromium's install contract is
  // "192 and 512, OR any" — assert that arm instead of the vector-only arm.
  it("ships the raster icon sizes Chromium needs to install", () => {
    const icons = manifest.icons ?? [];
    expect(icons.length).toBeGreaterThan(0);

    const has = (size: string) =>
      icons.some((i) => i.sizes === size || i.sizes === "any");
    expect(has("192x192")).toBe(true);
    expect(has("512x512")).toBe(true);
  });

  it("ships a maskable icon so Android does not letterbox the launcher", () => {
    expect(
      manifest.icons?.some((i) => i.purpose?.includes("maskable")),
    ).toBe(true);
  });
});
