import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/playlist.repo", () => ({
  searchPublishedPlaylists: vi.fn(),
  findPublishedPlaylistsByIds: vi.fn(),
}));

vi.mock("../repositories/track.repo", () => ({
  searchTracks: vi.fn(),
}));

const playlistRepo = await import("../repositories/playlist.repo");
const trackRepo = await import("../repositories/track.repo");
const service = await import("./search.service");

function makePlaylistLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => "pl1" },
    ar: { title: "سورة", slug: "سورة" },
    en: { title: "Surah", slug: "surah" },
    status: "published",
    coverMediaId: null,
    ...overrides,
  };
}

function makeTrackLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => "tr1" },
    ar: { title: "آية", slug: "aya-ar" },
    en: { title: "Verse", slug: "verse" },
    playlistId: { toString: () => "pl1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(playlistRepo.searchPublishedPlaylists).mockResolvedValue([]);
  vi.mocked(playlistRepo.findPublishedPlaylistsByIds).mockResolvedValue([]);
  vi.mocked(trackRepo.searchTracks).mockResolvedValue([]);
});

describe("search.service", () => {
  it("returns empty results for a blank query without hitting the repos", async () => {
    const result = await service.searchContent("en", "   ");
    expect(result).toEqual({ playlists: [], tracks: [] });
    expect(playlistRepo.searchPublishedPlaylists).not.toHaveBeenCalled();
    expect(trackRepo.searchTracks).not.toHaveBeenCalled();
  });

  it("resolves playlist hits to the requested locale", async () => {
    vi.mocked(playlistRepo.searchPublishedPlaylists).mockResolvedValue([
      makePlaylistLean(),
    ]);

    const en = await service.searchContent("en", "surah");
    expect(en.playlists[0]).toMatchObject({ title: "Surah", slug: "surah" });

    const ar = await service.searchContent("ar", "سورة");
    expect(ar.playlists[0]).toMatchObject({ title: "سورة", slug: "سورة" });
  });

  it("links track hits to their published parent playlist", async () => {
    vi.mocked(trackRepo.searchTracks).mockResolvedValue([makeTrackLean()]);
    vi.mocked(playlistRepo.findPublishedPlaylistsByIds).mockResolvedValue([
      makePlaylistLean(),
    ]);

    const result = await service.searchContent("en", "verse");
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      title: "Verse",
      playlistSlug: "surah",
      playlistTitle: "Surah",
    });
  });

  it("drops track hits whose parent playlist is missing or unpublished", async () => {
    vi.mocked(trackRepo.searchTracks).mockResolvedValue([makeTrackLean()]);
    // No published parent returned → hit is dropped (don't leak draft content).
    vi.mocked(playlistRepo.findPublishedPlaylistsByIds).mockResolvedValue([]);

    const result = await service.searchContent("en", "verse");
    expect(result.tracks).toEqual([]);
  });
});
