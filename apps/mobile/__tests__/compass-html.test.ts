import { compassHtml, type CompassPalette } from "@/features/qibla/lib/compass-html";

const palette: CompassPalette = {
  gold: "#c8a050",
  sun: "#e4c57e",
  muted: "#8a7a62",
  surface: "#1c1915",
  surface2: "#252018",
  border: "rgba(200,160,80,0.15)",
};

describe("compassHtml", () => {
  it("bakes in the bearing and the browser-sensor + GPU-rotation wiring", () => {
    const html = compassHtml(136, palette);
    expect(html).toContain("BEARING=136");
    // The same fused-sensor pipeline the web /qibla page uses.
    expect(html).toContain("deviceorientationabsolute");
    expect(html).toContain("webkitCompassHeading");
    // GPU transform (not a JS/SVG re-render).
    expect(html).toContain("rotate(");
    // Opaque background matching the card → no Android transparency/software layer.
    expect(html).toContain(palette.surface);
  });

  it("posts heading/alignment back to the native side", () => {
    const html = compassHtml(90, palette);
    expect(html).toContain("ReactNativeWebView.postMessage");
  });
});
