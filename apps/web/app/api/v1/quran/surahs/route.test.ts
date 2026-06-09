import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/quran", () => ({ listSurahs: vi.fn() }));

const { listSurahs } = await import("@repo/api/services/quran");
const { GET, OPTIONS } = await import("./route");

describe("GET /api/v1/quran/surahs", () => {
  it("returns the surah list", async () => {
    vi.mocked(listSurahs).mockResolvedValueOnce([
      { number: 1, name: { ar: "الفاتحة", en: "Al-Fatihah" }, meaning: "The Opening", revelationPlace: "meccan", ayahCount: 7, pageStart: 1, pageEnd: 1, bismillahPre: false },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body[0].name.ar).toBe("الفاتحة");
  });

  it("answers OPTIONS preflight", () => {
    expect(OPTIONS().status).toBe(204);
  });
});
