import { beforeEach, describe, expect, it, vi } from "vitest";

import { playlistsHomeTag, playlistTag } from "../cache/tags";
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
    contentId: { toString: () => "c1" },
    locale: "ar",
    title: "Title",
    slug: "title",
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

describe("playlist.service", () => {
  describe("getPublishedPlaylists", () => {
    it("passes the locale to the repo and returns DTOs without a session", async () => {
      vi.mocked(repo.findPublishedPlaylists).mockResolvedValueOnce([
        makeLean({ slug: "alpha" }),
        makeLean({ slug: "beta", _id: { toString: () => "p2" } }),
      ]);

      const result = await service.getPublishedPlaylists("ar");

      expect(repo.findPublishedPlaylists).toHaveBeenCalledWith("ar", undefined);
      expect(result).toHaveLength(2);
      expect(result[0]!.slug).toBe("alpha");
      expect(result[0]!.locale).toBe("ar");
      expect(requireSession).not.toHaveBeenCalled();
    });

    it("forwards a categoryContentId filter to the repo", async () => {
      vi.mocked(repo.findPublishedPlaylists).mockResolvedValueOnce([]);

      await service.getPublishedPlaylists("en", { categoryContentId: "cat1" });

      expect(repo.findPublishedPlaylists).toHaveBeenCalledWith("en", {
        categoryContentId: "cat1",
      });
    });
  });

  describe("createPlaylist", () => {
    it("requires admin session, parses input, and auto-derives slug", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.createPlaylist).mockResolvedValueOnce(
        makeLean({ slug: "my-playlist" }),
      );

      const result = await service.createPlaylist({
        locale: "en",
        title: "My Playlist!",
        status: "draft",
        categoryIds: [],
      });

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      const createArg = vi.mocked(repo.createPlaylist).mock.calls[0]![0];
      expect(createArg.slug).toBe("my-playlist");
      // First locale mints a contentId (24-hex ObjectId string).
      expect(createArg.contentId).toMatch(/^[0-9a-f]{24}$/);
      expect(result.slug).toBe("my-playlist");
    });

    it("derives a non-empty slug from an Arabic-only title (ADR 0002)", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.createPlaylist).mockImplementationOnce(
        async (data: any) => makeLean({ slug: data.slug }),
      );

      const result = await service.createPlaylist({
        locale: "ar",
        title: "سورة البقرة",
        status: "draft",
        categoryIds: [],
      });

      const createArg = vi.mocked(repo.createPlaylist).mock.calls[0]![0];
      expect(createArg.slug.length).toBeGreaterThan(0);
      expect(createArg.slug).toBe("سورة-البقرة");
      expect(result.slug).toBe("سورة-البقرة");
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
    it("flips status to published and revalidates locale-scoped tags", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.updatePlaylistById).mockResolvedValueOnce(
        makeLean({ slug: "alpha", status: "published", locale: "ar" }),
      );

      await service.publishPlaylist("p1");

      expect(repo.updatePlaylistById).toHaveBeenCalledWith("p1", {
        status: "published",
      });
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistsHomeTag("ar"),
        "default",
      );
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistTag("ar", "alpha"),
        "default",
      );
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
