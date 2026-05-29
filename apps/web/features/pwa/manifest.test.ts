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
    icons?: Array<{ src: string; sizes: string }>;
  };

  it("declares the fields required for install", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe("/ar");
    expect(manifest.display).toBe("standalone");
  });

  it("ships at least one icon usable at any size", () => {
    expect(manifest.icons?.length).toBeGreaterThan(0);
    expect(manifest.icons?.some((i) => i.sizes === "any")).toBe(true);
  });
});
