import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/quran", () => ({ getSurahReader: vi.fn() }));

const { getSurahReader } = await import("@repo/api/services/quran");
const { GET } = await import("./route");

function req(url: string): Request {
  return new Request(`http://localhost${url}`);
}
const params = (n: string) => ({ params: Promise.resolve({ n }) });

const reader = {
  surah: { number: 1, name: { ar: "الفاتحة", en: "Al-Fatihah" }, meaning: "The Opening", revelationPlace: "meccan" as const, ayahCount: 7, pageStart: 1, pageEnd: 1, bismillahPre: false },
  ayahs: [],
  translationEdition: null,
  reciter: null,
};

describe("GET /api/v1/quran/surah/:n", () => {
  it("returns the reader for ar", async () => {
    vi.mocked(getSurahReader).mockResolvedValueOnce(reader);
    const res = await GET(req("/api/v1/quran/surah/1?locale=ar"), params("1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.surah.name.ar).toBe("الفاتحة");
  });

  it("returns the reader for en", async () => {
    vi.mocked(getSurahReader).mockResolvedValueOnce(reader);
    const res = await GET(req("/api/v1/quran/surah/1?locale=en"), params("1"));
    expect(res.status).toBe(200);
  });

  it("400s on invalid surah number", async () => {
    const res = await GET(req("/api/v1/quran/surah/200"), params("200"));
    expect(res.status).toBe(400);
  });

  it("404s when surah not found", async () => {
    const { AppError } = await import("@repo/api/errors");
    vi.mocked(getSurahReader).mockRejectedValueOnce(AppError.NotFound("Surah"));
    const res = await GET(req("/api/v1/quran/surah/1"), params("1"));
    expect(res.status).toBe(404);
  });
});
