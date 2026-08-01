import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/quran", () => ({ getTafsir: vi.fn() }));

const { getTafsir } = await import("@repo/api/services/quran");
const { GET, OPTIONS } = await import("./route");

function req(url: string): Request {
  return new Request(`http://localhost${url}`);
}

describe("GET /api/v1/quran/tafsir", () => {
  it("returns the tafsir json the service resolves", async () => {
    // Sanitization happens in quran.service.ts getTafsir (before the cache
    // write) — see packages/api/src/utils/sanitize-html.test.ts and
    // quran.service.test.ts. The route is a thin passthrough; here the mock
    // stands in for an already-sanitized service result.
    vi.mocked(getTafsir).mockResolvedValueOnce({
      edition: { slug: "ar.saadi", language: "ar", name: "x", author: "x", type: "tafsir", dir: "rtl" },
      html: "<p>ok</p>",
    });
    const res = await GET(req("/api/v1/quran/tafsir?ayah=1&locale=ar"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.html).toBe("<p>ok</p>");
  });

  it("400s on invalid ayah", async () => {
    const res = await GET(req("/api/v1/quran/tafsir?ayah=99999&locale=en"));
    expect(res.status).toBe(400);
  });

  it("404s when no tafsir exists", async () => {
    vi.mocked(getTafsir).mockResolvedValueOnce(null);
    const res = await GET(req("/api/v1/quran/tafsir?ayah=1&locale=ar"));
    expect(res.status).toBe(404);
  });

  it("answers OPTIONS preflight with CORS headers", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });
});
