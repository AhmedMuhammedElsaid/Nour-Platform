import { buildAdhkarRow } from "@/features/adhkar/widget/build-adhkar-row";

describe("buildAdhkarRow", () => {
  it("returns the locale-appropriate static label + icon key", () => {
    expect(buildAdhkarRow("en")).toEqual({ label: "Adhkar", iconKey: "adhkar" });
    expect(buildAdhkarRow("ar")).toEqual({ label: "الأذكار", iconKey: "adhkar" });
  });
});
