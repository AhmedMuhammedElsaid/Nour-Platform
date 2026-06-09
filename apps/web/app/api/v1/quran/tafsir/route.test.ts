import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/quran", () => ({ getTafsir: vi.fn() }));

const { getTafsir } = await import("@repo/api/services/quran");
const { GET, OPTIONS } = await import("./route");

function req(url: string): Request {
  return new Request(`http://localhost${url}`);
}

describe("GET /api/v1/quran/tafsir", () => {
  it("returns tafsir json for ar+en and strips <script>", async () => {
    vi.mocked(getTafsir).mockResolvedValueOnce({
      edition: { slug: "ar.saadi", language: "ar", name: "x", author: "x", type: "tafsir", dir: "rtl" },
      html: "<p>ok</p><script>alert(1)</script>",
    });
    const res = await GET(req("/api/v1/quran/tafsir?ayah=1&locale=ar"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.html).not.toContain("<script>");
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
