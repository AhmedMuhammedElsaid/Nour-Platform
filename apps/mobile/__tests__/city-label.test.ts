import { cityLabel } from "@/features/prayer-times/data/cities";

describe("cityLabel", () => {
  it("returns the Arabic name when locale is ar and cityId matches", () => {
    expect(cityLabel({ cityId: "cairo", label: "Cairo" }, "ar")).toBe("القاهرة");
  });

  it("returns the English name when locale is en and cityId matches", () => {
    expect(cityLabel({ cityId: "cairo", label: "القاهرة" }, "en")).toBe("Cairo");
  });

  it("falls back to label when cityId is absent", () => {
    expect(cityLabel({ label: "My GPS Location" }, "ar")).toBe("My GPS Location");
  });

  it("falls back to label when cityId does not match any curated city", () => {
    expect(cityLabel({ cityId: "unknown-xyz", label: "Somewhere" }, "ar")).toBe("Somewhere");
  });
});
