import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/playlist", () => ({ getPlaylistBySlug: vi.fn() }));
vi.mock("@repo/api/services/track", () => ({ getTracksWithUrls: vi.fn() }));

const { getPlaylistBySlug } = await import("@repo/api/services/playlist");
const { getTracksWithUrls } = await import("@repo/api/services/track");
const { GET } = await import("./route");

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
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("GET /api/v1/playlists/:slug", () => {
  it("returns playlist + tracks for ar", async () => {
    vi.mocked(getPlaylistBySlug).mockResolvedValueOnce(playlist);
    vi.mocked(getTracksWithUrls).mockResolvedValueOnce([]);
    const res = await GET(req("/api/v1/playlists/a?locale=ar"), params("a"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.playlist.ar.slug).toBe("a");
    expect(body.tracks).toEqual([]);
  });

  it("returns playlist + tracks for en", async () => {
    vi.mocked(getPlaylistBySlug).mockResolvedValueOnce(playlist);
    vi.mocked(getTracksWithUrls).mockResolvedValueOnce([]);
    const res = await GET(req("/api/v1/playlists/b?locale=en"), params("b"));
    expect(res.status).toBe(200);
  });

  it("404s on unknown slug", async () => {
    vi.mocked(getPlaylistBySlug).mockResolvedValueOnce(null);
    const res = await GET(req("/api/v1/playlists/missing"), params("missing"));
    expect(res.status).toBe(404);
  });

  it("404s on draft playlist", async () => {
    vi.mocked(getPlaylistBySlug).mockResolvedValueOnce({ ...playlist, status: "draft" });
    const res = await GET(req("/api/v1/playlists/a"), params("a"));
    expect(res.status).toBe(404);
  });
});
