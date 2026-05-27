import { beforeEach, describe, expect, it, vi } from "vitest";

import { playlistTag } from "../cache/tags";
import { AppError } from "../errors";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("../auth/require-session", () => ({ requireSession: vi.fn() }));
vi.mock("../repositories/media.repo", () => ({ findMediaById: vi.fn() }));
vi.mock("../repositories/playlist.repo", () => ({
  findPlaylistById: vi.fn(),
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
const PLAYLIST_ID = "507f1f77bcf86cd799439021";
const TRACK_ID = "507f1f77bcf86cd799439012";
const MEDIA_ID = "507f1f77bcf86cd799439013";
const MISSING_ID = "507f1f77bcf86cd799439099";

function trackLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => TRACK_ID },
    ar: { title: "عنوان", slug: "عنوان" },
    en: { title: "Title", slug: "title" },
    mediaId: { toString: () => MEDIA_ID },
    playlistId: { toString: () => PLAYLIST_ID },
    order: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function playlistLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => PLAYLIST_ID },
    ar: { title: "قائمة", slug: "قائمة" },
    en: { title: "Playlist", slug: "playlist" },
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
    it("creates the track and revalidates the playlist id tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistById).mockResolvedValueOnce(
        playlistLean(),
      );
      // One existing track → next order is 1.
      vi.mocked(trackRepo.findTracksByPlaylist).mockResolvedValueOnce([
        trackLean(),
      ]);
      vi.mocked(trackRepo.createTrack).mockResolvedValueOnce(trackLean());

      const result = await service.createTrack({
        ar: { title: "Intro" },
        en: { title: "Intro" },
        playlistId: PLAYLIST_ID,
        mediaId: MEDIA_ID,
      });

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      const createArg = vi.mocked(trackRepo.createTrack).mock.calls[0]![0];
      expect(createArg.ar.slug).toBe("intro");
      expect(createArg.en.slug).toBe("intro");
      // order defaults to the current track count when not supplied.
      expect(createArg.order).toBe(1);
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistTag(PLAYLIST_ID),
        "default",
      );
      expect(result.id).toBe(TRACK_ID);
    });

    it("throws NotFound when the parent playlist is missing", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistById).mockResolvedValueOnce(null);

      await expect(
        service.createTrack({
          ar: { title: "Intro" },
          en: { title: "Intro" },
          playlistId: MISSING_ID,
          mediaId: MEDIA_ID,
        }),
      ).rejects.toBeInstanceOf(AppError);
      expect(trackRepo.createTrack).not.toHaveBeenCalled();
    });
  });

  describe("reorderTracks", () => {
    it("rejects when the playlist is missing", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistById).mockResolvedValueOnce(null);

      await expect(
        service.reorderTracks(MISSING_ID, [TRACK_ID, MEDIA_ID]),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(trackRepo.updateTrackOrder).not.toHaveBeenCalled();
    });

    it("writes order and revalidates the playlist id tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistById).mockResolvedValueOnce(
        playlistLean(),
      );

      const newOrder = [TRACK_ID, MEDIA_ID];
      await service.reorderTracks(PLAYLIST_ID, newOrder);

      expect(trackRepo.updateTrackOrder).toHaveBeenCalledWith(newOrder);
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistTag(PLAYLIST_ID),
        "default",
      );
    });
  });
});
