import { beforeEach, describe, expect, it, vi } from "vitest";

import { playlistTag } from "../cache/tags";
import { AppError } from "../errors";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("../auth/require-session", () => ({ requireSession: vi.fn() }));
vi.mock("../repositories/media.repo", () => ({ findMediaById: vi.fn() }));
vi.mock("../repositories/playlist.repo", () => ({
  findPlaylistsByContentId: vi.fn(),
}));
vi.mock("../repositories/track.repo", () => ({
  createTrack: vi.fn(),
  deleteTrackById: vi.fn(),
  findTrackById: vi.fn(),
  findTracksByPlaylist: vi.fn(),
  updateTrackById: vi.fn(),
  updateTrackOrder: vi.fn(),
}));

const { revalidateTag } = await import("next/cache");
const { requireSession } = await import("../auth/require-session");
const playlistRepo = await import("../repositories/playlist.repo");
const trackRepo = await import("../repositories/track.repo");
const service = await import("./track.service");

// ObjectId-shaped strings — the Zod schemas validate the regex.
const PLAYLIST_CONTENT_ID = "507f1f77bcf86cd799439021";
const TRACK_ID = "507f1f77bcf86cd799439012";
const MEDIA_ID = "507f1f77bcf86cd799439013";
const MISSING_ID = "507f1f77bcf86cd799439099";

function trackLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => TRACK_ID },
    contentId: { toString: () => "507f1f77bcf86cd799439031" },
    locale: "ar",
    title: "Track",
    slug: "track",
    mediaId: { toString: () => MEDIA_ID },
    playlistContentId: { toString: () => PLAYLIST_CONTENT_ID },
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function playlistLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => "507f1f77bcf86cd799439011" },
    contentId: { toString: () => PLAYLIST_CONTENT_ID },
    locale: "ar",
    title: "Playlist",
    slug: "playlist",
    status: "draft",
    categoryIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("track.service", () => {
  describe("createTrack", () => {
    it("creates the track in the playlist locale and revalidates the slug tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistsByContentId).mockResolvedValueOnce([
        playlistLean({ slug: "alpha", locale: "ar" }),
      ]);
      // One existing track → next order is 1.
      vi.mocked(trackRepo.findTracksByPlaylist).mockResolvedValueOnce([
        trackLean(),
      ]);
      vi.mocked(trackRepo.createTrack).mockResolvedValueOnce(trackLean());

      const result = await service.createTrack({
        locale: "ar",
        title: "Intro",
        playlistContentId: PLAYLIST_CONTENT_ID,
        mediaId: MEDIA_ID,
      } as any);

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      const createArg = vi.mocked(trackRepo.createTrack).mock.calls[0]![0];
      expect(createArg.slug).toBe("intro");
      // order defaults to the current track count when not supplied.
      expect(createArg.order).toBe(1);
      expect(createArg.contentId).toMatch(/^[0-9a-f]{24}$/);
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistTag("ar", "alpha"),
        "default",
      );
      expect(result.id).toBe(TRACK_ID);
    });

    it("throws NotFound when the parent playlist variant is missing", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      // Playlist exists in 'en' only — creating an 'ar' track must fail.
      vi.mocked(playlistRepo.findPlaylistsByContentId).mockResolvedValueOnce([
        playlistLean({ locale: "en" }),
      ]);

      await expect(
        service.createTrack({
          locale: "ar",
          title: "Intro",
          playlistContentId: MISSING_ID,
          mediaId: MEDIA_ID,
        } as any),
      ).rejects.toBeInstanceOf(AppError);
      expect(trackRepo.createTrack).not.toHaveBeenCalled();
    });
  });

  describe("reorderTracks", () => {
    it("rejects when the playlist variant is missing", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistsByContentId).mockResolvedValueOnce([]);

      await expect(
        service.reorderTracks("ar", MISSING_ID, [TRACK_ID, MEDIA_ID]),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(trackRepo.updateTrackOrder).not.toHaveBeenCalled();
    });

    it("writes order (no trackIds mirror) and revalidates the slug tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistsByContentId).mockResolvedValueOnce([
        playlistLean({ slug: "beta", locale: "ar" }),
      ]);

      const newOrder = [TRACK_ID, MEDIA_ID];
      await service.reorderTracks("ar", PLAYLIST_CONTENT_ID, newOrder);

      expect(trackRepo.updateTrackOrder).toHaveBeenCalledWith(newOrder);
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistTag("ar", "beta"),
        "default",
      );
    });
  });
});
