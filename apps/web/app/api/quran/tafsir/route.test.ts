import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/quran", () => ({ getTafsir: vi.fn() }));

const { getTafsir } = await import("@repo/api/services/quran");
const { GET } = await import("./route");

function req(url: string): Request {
  return new Request(`http://localhost${url}`);
}

describe("GET /api/quran/tafsir", () => {
  it("returns tafsir json with an immutable cache header", async () => {
    vi.mocked(getTafsir).mockResolvedValueOnce({
      edition: { slug: "en.ibnkathir", language: "en", name: "Ibn Kathir", author: "Ibn Kathir", type: "tafsir", dir: "ltr" },
      html: "<p>Tafsir</p>",
    });
    const res = await GET(req("/api/quran/tafsir?ayah=1&locale=en"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("immutable");
    const body = await res.json();
    expect(body.html).toBe("<p>Tafsir</p>");
  });

  it("strips <script> from the html", async () => {
    vi.mocked(getTafsir).mockResolvedValueOnce({
      edition: { slug: "en.ibnkathir", language: "en", name: "x", author: "x", type: "tafsir", dir: "ltr" },
      html: "<p>ok</p><script>alert(1)</script>",
    });
    const res = await GET(req("/api/quran/tafsir?ayah=1&locale=en"));
    const body = await res.json();
    expect(body.html).not.toContain("<script>");
    expect(body.html).toContain("<p>ok</p>");
  });

  it("400s on invalid ayah", async () => {
    const res = await GET(req("/api/quran/tafsir?ayah=99999&locale=en"));
    expect(res.status).toBe(400);
  });

  it("404s when no tafsir exists", async () => {
    vi.mocked(getTafsir).mockResolvedValueOnce(null);
    const res = await GET(req("/api/quran/tafsir?ayah=1&locale=ar"));
    expect(res.status).toBe(404);
  });
});
