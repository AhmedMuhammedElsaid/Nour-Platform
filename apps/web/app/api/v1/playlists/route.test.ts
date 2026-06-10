import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cached-content", () => ({
  getCachedPublishedPlaylists: vi.fn(),
  getCachedCategories: vi.fn(),
}));

const { getCachedPublishedPlaylists, getCachedCategories } = await import(
  "@/lib/cached-content"
);
const { GET, OPTIONS } = await import("./route");

function req(url: string): Request {
  return new Request(`http://localhost${url}`);
}

const playlist = {
  id: "507f1f77bcf86cd799439011",
  ar: { title: "أ", slug: "a" },
  en: { title: "B", slug: "b" },
  status: "published" as const,
  categoryIds: [],
  order: 0,
  trackCount: 3,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

describe("GET /api/v1/playlists", () => {
  it("returns playlists with embedded ar+en and ISO dates", async () => {
    vi.mocked(getCachedPublishedPlaylists).mockResolvedValueOnce([playlist]);
    const res = await GET(req("/api/v1/playlists"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].ar.title).toBe("أ");
    expect(body[0].en.title).toBe("B");
    expect(body[0].createdAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("sets CORS headers", async () => {
    vi.mocked(getCachedPublishedPlaylists).mockResolvedValueOnce([]);
    const res = await GET(req("/api/v1/playlists"));
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  it("resolves ?category=<slug> to an id", async () => {
    vi.mocked(getCachedCategories).mockResolvedValueOnce([
      { id: "cat1", ar: { name: "ك", slug: "k" }, en: { name: "C", slug: "c" }, createdAt: new Date(), updatedAt: new Date() },
    ]);
    vi.mocked(getCachedPublishedPlaylists).mockResolvedValueOnce([playlist]);
    const res = await GET(req("/api/v1/playlists?category=c"));
    expect(getCachedPublishedPlaylists).toHaveBeenCalledWith("cat1");
    expect(res.status).toBe(200);
  });

  it("returns empty array for unknown category slug", async () => {
    vi.mocked(getCachedCategories).mockResolvedValueOnce([]);
    const res = await GET(req("/api/v1/playlists?category=missing"));
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("answers OPTIONS preflight with CORS headers", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
