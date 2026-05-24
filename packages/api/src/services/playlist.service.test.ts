import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAYLISTS_HOME } from "../cache/tags";
import { AppError } from "../errors";

// Module-level mocks. Hoisted by vitest before service import.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("../auth/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("../repositories/playlist.repo", () => ({
  createPlaylist: vi.fn(),
  deletePlaylistById: vi.fn(),
  findAllPlaylists: vi.fn(),
  findPlaylistById: vi.fn(),
  findPlaylistBySlug: vi.fn(),
  findPublishedPlaylists: vi.fn(),
  updatePlaylistById: vi.fn(),
}));

const { revalidateTag } = await import("next/cache");
const { requireSession } = await import("../auth/require-session");
const repo = await import("../repositories/playlist.repo");
const service = await import("./playlist.service");

function makeLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => "p1" },
    title: "Title",
    slug: "title",
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

describe("playlist.service", () => {
  describe("getPublishedPlaylists", () => {
    it("returns DTOs from the repo without requiring a session", async () => {
      vi.mocked(repo.findPublishedPlaylists).mockResolvedValueOnce([
        makeLean({ slug: "alpha" }),
        makeLean({ slug: "beta", _id: { toString: () => "p2" } }),
      ]);

      const result = await service.getPublishedPlaylists();

      expect(result).toHaveLength(2);
      expect(result[0]!.slug).toBe("alpha");
      expect(requireSession).not.toHaveBeenCalled();
    });
  });

  describe("createPlaylist", () => {
    it("requires admin session, parses input, and auto-derives slug", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.createPlaylist).mockResolvedValueOnce(
        makeLean({ slug: "my-playlist" }),
      );

      const result = await service.createPlaylist({
        title: "My Playlist!",
        status: "draft",
        trackIds: [],
        categoryIds: [],
      });

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      expect(vi.mocked(repo.createPlaylist).mock.calls[0]![0].slug).toBe(
        "my-playlist",
      );
      expect(result.slug).toBe("my-playlist");
    });

    it("propagates Zod validation errors as thrown ZodError", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);

      await expect(
        service.createPlaylist({ title: "", status: "draft" } as any),
      ).rejects.toThrow();
      expect(repo.createPlaylist).not.toHaveBeenCalled();
    });
  });

  describe("publishPlaylist", () => {
    it("flips status to published and revalidates home + slug tags", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.updatePlaylistById).mockResolvedValueOnce(
        makeLean({ slug: "alpha", status: "published" }),
      );

      await service.publishPlaylist("p1");

      expect(repo.updatePlaylistById).toHaveBeenCalledWith("p1", {
        status: "published",
      });
      expect(revalidateTag).toHaveBeenCalledWith(PLAYLISTS_HOME, "default");
      expect(revalidateTag).toHaveBeenCalledWith("playlist:alpha", "default");
    });

    it("throws NotFound and skips revalidation when the playlist is missing", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.updatePlaylistById).mockResolvedValueOnce(null as any);

      await expect(service.publishPlaylist("missing")).rejects.toBeInstanceOf(
        AppError,
      );
      expect(revalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("getAllPlaylists", () => {
    it("rejects non-admin callers with Forbidden", async () => {
      await expect(
        service.getAllPlaylists({ user: { role: "user" } } as any),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repo.findAllPlaylists).not.toHaveBeenCalled();
    });
  });
});
