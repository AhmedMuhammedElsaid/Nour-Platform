import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/quran", () => ({ getPageReader: vi.fn() }));

const { getPageReader } = await import("@repo/api/services/quran");
const { GET } = await import("./route");

function req(url: string): Request {
  return new Request(`http://localhost${url}`);
}
const params = (n: string) => ({ params: Promise.resolve({ n }) });

const reader = {
  page: 1,
  juz: 1,
  prevPage: null,
  nextPage: 2,
  segments: [
    {
      surah: { number: 1, name: { ar: "الفاتحة", en: "Al-Fatihah" }, meaning: "The Opening", bismillahPre: false },
      showBismillah: false,
      ayahs: [],
    },
  ],
  translationEdition: null,
  reciter: null,
};

describe("GET /api/v1/quran/page/:n", () => {
  it("returns the page reader for ar", async () => {
    vi.mocked(getPageReader).mockResolvedValueOnce(reader);
    const res = await GET(req("/api/v1/quran/page/1?locale=ar"), params("1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.segments[0].surah.name.ar).toBe("الفاتحة");
  });

  it("returns the page reader for en", async () => {
    vi.mocked(getPageReader).mockResolvedValueOnce(reader);
    const res = await GET(req("/api/v1/quran/page/1?locale=en"), params("1"));
    expect(res.status).toBe(200);
  });

  it("400s on invalid page number", async () => {
    const res = await GET(req("/api/v1/quran/page/605"), params("605"));
    expect(res.status).toBe(400);
  });

  it("400s on non-numeric page param", async () => {
    const res = await GET(req("/api/v1/quran/page/abc"), params("abc"));
    expect(res.status).toBe(400);
  });

  it("404s when the page has no ayahs", async () => {
    const { AppError } = await import("@repo/api/errors");
    vi.mocked(getPageReader).mockRejectedValueOnce(AppError.NotFound("Page"));
    const res = await GET(req("/api/v1/quran/page/1"), params("1"));
    expect(res.status).toBe(404);
  });
});
