import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("../auth/require-session", () => ({ requireSession: vi.fn() }));
vi.mock("../repositories/media.repo", () => ({ findMediaById: vi.fn() }));
vi.mock("../repositories/playlist.repo", () => ({
  appendTrackId: vi.fn(),
  findPlaylistById: vi.fn(),
  removeTrackId: vi.fn(),
  updatePlaylistById: vi.fn(),
}));
vi.mock("../repositories/track.repo", () => ({
  createTrack: vi.fn(),
  deleteTrackById: vi.fn(),
  findTrackById: vi.fn(),
  findTracksByPlaylistId: vi.fn(),
  updateTrackById: vi.fn(),
  updateTrackOrder: vi.fn(),
}));

const { revalidateTag } = await import("next/cache");
const { requireSession } = await import("../auth/require-session");
const playlistRepo = await import("../repositories/playlist.repo");
const trackRepo = await import("../repositories/track.repo");
const service = await import("./track.service");

// ObjectId-shaped strings — the Zod schemas validate the regex.
const PLAYLIST_ID = "507f1f77bcf86cd799439011";
const TRACK_ID = "507f1f77bcf86cd799439012";
const MEDIA_ID = "507f1f77bcf86cd799439013";
const MISSING_ID = "507f1f77bcf86cd799439099";

function trackLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => TRACK_ID },
    title: "Track",
    slug: "track",
    mediaId: { toString: () => MEDIA_ID },
    playlistId: { toString: () => PLAYLIST_ID },
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function playlistLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => PLAYLIST_ID },
    title: "Playlist",
    slug: "playlist",
    status: "draft",
    trackIds: [],
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
    it("creates the track, appends to the playlist, and revalidates the slug tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistById).mockResolvedValueOnce(
        playlistLean({ slug: "alpha", trackIds: ["existing"] }),
      );
      vi.mocked(trackRepo.createTrack).mockResolvedValueOnce(trackLean());

      const result = await service.createTrack({
        title: "Intro",
        playlistId: PLAYLIST_ID,
        mediaId: MEDIA_ID,
      } as any);

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      const createArg = vi.mocked(trackRepo.createTrack).mock.calls[0]![0];
      expect(createArg.slug).toBe("intro");
      // order defaults to current trackIds length when not supplied
      expect(createArg.order).toBe(1);
      expect(playlistRepo.appendTrackId).toHaveBeenCalledWith(
        PLAYLIST_ID,
        TRACK_ID,
      );
      expect(revalidateTag).toHaveBeenCalledWith("playlist:alpha", "default");
      expect(result.id).toBe(TRACK_ID);
    });

    it("throws NotFound when the parent playlist is missing", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistById).mockResolvedValueOnce(null as any);

      await expect(
        service.createTrack({
          title: "Intro",
          playlistId: MISSING_ID,
          mediaId: MEDIA_ID,
        } as any),
      ).rejects.toBeInstanceOf(AppError);
      expect(trackRepo.createTrack).not.toHaveBeenCalled();
    });
  });

  describe("reorderTracks", () => {
    it("rejects when playlist is missing", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistById).mockResolvedValueOnce(null as any);

      await expect(
        service.reorderTracks(MISSING_ID, [TRACK_ID, MEDIA_ID]),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(trackRepo.updateTrackOrder).not.toHaveBeenCalled();
    });

    it("writes order, syncs playlist trackIds, and revalidates", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(playlistRepo.findPlaylistById).mockResolvedValueOnce(
        playlistLean({ slug: "beta" }),
      );

      const newOrder = [TRACK_ID, MEDIA_ID];
      await service.reorderTracks(PLAYLIST_ID, newOrder);

      expect(trackRepo.updateTrackOrder).toHaveBeenCalledWith(newOrder);
      expect(playlistRepo.updatePlaylistById).toHaveBeenCalledWith(PLAYLIST_ID, {
        trackIds: newOrder,
      });
      expect(revalidateTag).toHaveBeenCalledWith("playlist:beta", "default");
    });
  });
});
