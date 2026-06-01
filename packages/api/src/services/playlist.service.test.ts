import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAYLISTS_HOME, playlistTag } from "../cache/tags";
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
  updatePlaylistOrder: vi.fn(),
}));

vi.mock("../repositories/category.repo", () => ({
  findById: vi.fn(),
}));

// PlaylistModel is imported directly for countDocuments (default order on create).
vi.mock("../db/models/playlist.model", () => ({
  PlaylistModel: {
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}));

const { revalidateTag } = await import("next/cache");
const { requireSession } = await import("../auth/require-session");
const repo = await import("../repositories/playlist.repo");
const service = await import("./playlist.service");

// Adapter boundary: cast lean fixture to PlaylistLeanWithCount so Vitest
// mocks satisfy the repo's return type. The fixture supplies all fields the
// service reads; trackCount defaults to 0 (list queries always include it).
import type { PlaylistLeanWithCount } from "../repositories/playlist.repo";

function makeLean(overrides: Record<string, unknown> = {}): PlaylistLeanWithCount {
  return {
    _id: { toString: () => "playlist123456789012" },
    ar: { title: "عنوان", slug: "عنوان" },
    en: { title: "Title", slug: "title" },
    coverMediaId: null,
    status: "draft",
    categoryIds: [],
    order: 0,
    trackCount: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  } as unknown as PlaylistLeanWithCount;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("playlist.service", () => {
  describe("getPublishedPlaylists", () => {
    it("returns DTOs without a session", async () => {
      vi.mocked(repo.findPublishedPlaylists).mockResolvedValueOnce([
        makeLean({ en: { title: "Alpha", slug: "alpha" }, ar: { title: "ألفا", slug: "ألفا" } }),
        makeLean({
          _id: { toString: () => "playlist123456789013" },
          en: { title: "Beta", slug: "beta" },
          ar: { title: "بيتا", slug: "بيتا" },
        }),
      ]);

      const result = await service.getPublishedPlaylists();

      expect(repo.findPublishedPlaylists).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(2);
      expect(result[0]!.en.slug).toBe("alpha");
      expect(result[0]!.ar.slug).toBe("ألفا");
      expect(requireSession).not.toHaveBeenCalled();
    });

    it("forwards a categoryId filter to the repo", async () => {
      vi.mocked(repo.findPublishedPlaylists).mockResolvedValueOnce([]);

      await service.getPublishedPlaylists({ categoryId: "aaaaaaaaaaaaaaaaaaaaaaaa" });

      expect(repo.findPublishedPlaylists).toHaveBeenCalledWith({
        categoryId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      });
    });

    it("exposes trackCount from the aggregation result in the DTO", async () => {
      vi.mocked(repo.findPublishedPlaylists).mockResolvedValueOnce([
        makeLean({ trackCount: 7 }),
      ]);

      const result = await service.getPublishedPlaylists();

      expect(result[0]!.trackCount).toBe(7);
    });
  });

  describe("getPlaylistBySlug", () => {
    it("returns a DTO when found", async () => {
      vi.mocked(repo.findPlaylistBySlug).mockResolvedValueOnce(
        makeLean({ en: { title: "Alpha", slug: "alpha" } }),
      );

      const result = await service.getPlaylistBySlug("en", "alpha");

      expect(repo.findPlaylistBySlug).toHaveBeenCalledWith("en", "alpha");
      expect(result).not.toBeNull();
      expect(result!.en.slug).toBe("alpha");
    });

    it("returns null when not found", async () => {
      vi.mocked(repo.findPlaylistBySlug).mockResolvedValueOnce(null);

      const result = await service.getPlaylistBySlug("ar", "missing");

      expect(result).toBeNull();
    });
  });

  describe("createPlaylist", () => {
    it("requires admin session, parses input, and auto-derives both locale slugs", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.createPlaylist).mockResolvedValueOnce(
        makeLean({
          ar: { title: "قائمة", slug: "قائمة" },
          en: { title: "My Playlist", slug: "my-playlist" },
        }),
      );

      const result = await service.createPlaylist({
        ar: { title: "قائمة" },
        en: { title: "My Playlist!" },
        status: "draft",
        categoryIds: [],
      });

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      const createArg = vi.mocked(repo.createPlaylist).mock.calls[0]![0];
      // AR slug auto-derived from title
      expect(createArg.ar.slug).toBe("قائمة");
      // EN slug auto-derived from title (with punctuation stripped)
      expect(createArg.en.slug).toBe("my-playlist");
      expect(result.en.slug).toBe("my-playlist");
      // order defaults to countDocuments() result (mock returns 0)
      expect(createArg.order).toBe(0);
    });

    it("derives a non-empty AR slug from an Arabic-only title (ADR 0002)", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.createPlaylist).mockImplementationOnce(
        async (data) => makeLean({ ar: { title: data.ar.title, slug: data.ar.slug } }),
      );

      await service.createPlaylist({
        ar: { title: "سورة البقرة" },
        en: { title: "Al-Baqarah" },
        status: "draft",
        categoryIds: [],
      });

      const createArg = vi.mocked(repo.createPlaylist).mock.calls[0]![0];
      expect(createArg.ar.slug.length).toBeGreaterThan(0);
      expect(createArg.ar.slug).toBe("سورة-البقرة");
    });

    it("forwards bilingual scholarName + scholarImage to the repo and DTO", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.createPlaylist).mockResolvedValueOnce(
        makeLean({
          ar: { title: "عنوان", slug: "عنوان", scholarName: "د. صابر عادل" },
          en: { title: "Title", slug: "title", scholarName: "Dr. Saber Adel" },
          scholarImage: "/dr-saber-adel.jpg",
        }),
      );

      const result = await service.createPlaylist({
        ar: { title: "عنوان", scholarName: "د. صابر عادل" },
        en: { title: "Title", scholarName: "Dr. Saber Adel" },
        scholarImage: "/dr-saber-adel.jpg",
        status: "draft",
        categoryIds: [],
      });

      const createArg = vi.mocked(repo.createPlaylist).mock.calls[0]![0];
      expect(createArg.ar.scholarName).toBe("د. صابر عادل");
      expect(createArg.en.scholarName).toBe("Dr. Saber Adel");
      expect(createArg.scholarImage).toBe("/dr-saber-adel.jpg");
      // DTO round-trips the new fields back to callers.
      expect(result.ar.scholarName).toBe("د. صابر عادل");
      expect(result.scholarImage).toBe("/dr-saber-adel.jpg");
    });

    it("forwards a soundcloudUrl to the repo and round-trips it in the DTO", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.createPlaylist).mockResolvedValueOnce(
        makeLean({ soundcloudUrl: "https://soundcloud.com/user/sets/lectures" }),
      );

      const result = await service.createPlaylist({
        ar: { title: "عنوان" },
        en: { title: "Title" },
        soundcloudUrl: "https://soundcloud.com/user/sets/lectures",
        status: "draft",
        categoryIds: [],
      });

      const createArg = vi.mocked(repo.createPlaylist).mock.calls[0]![0];
      expect(createArg.soundcloudUrl).toBe("https://soundcloud.com/user/sets/lectures");
      expect(result.soundcloudUrl).toBe("https://soundcloud.com/user/sets/lectures");
    });

    it("rejects a soundcloudUrl whose host is not soundcloud.com", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);

      await expect(
        service.createPlaylist({
          ar: { title: "عنوان" },
          en: { title: "Title" },
          soundcloudUrl: "https://evil.example.com/track",
          status: "draft",
          categoryIds: [],
        }),
      ).rejects.toThrow();
      expect(repo.createPlaylist).not.toHaveBeenCalled();
    });

    it("propagates Zod validation errors as thrown ZodError", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);

      await expect(
        service.createPlaylist({ ar: { title: "" }, en: { title: "" }, status: "draft", categoryIds: [] }),
      ).rejects.toThrow();
      expect(repo.createPlaylist).not.toHaveBeenCalled();
    });
  });

  describe("publishPlaylist", () => {
    it("flips status to published and revalidates id-scoped tags", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.updatePlaylistById).mockResolvedValueOnce(
        makeLean({
          _id: { toString: () => "playlist123456789012" },
          status: "published",
        }),
      );

      await service.publishPlaylist("playlist123456789012");

      expect(repo.updatePlaylistById).toHaveBeenCalledWith("playlist123456789012", {
        status: "published",
      });
      expect(revalidateTag).toHaveBeenCalledWith(PLAYLISTS_HOME, "default");
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistTag("playlist123456789012"),
        "default",
      );
    });

    it("throws NotFound and skips revalidation when the playlist is missing", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.updatePlaylistById).mockResolvedValueOnce(null as never);

      await expect(service.publishPlaylist("missing")).rejects.toBeInstanceOf(
        AppError,
      );
      expect(revalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("unpublishPlaylist", () => {
    it("flips status to draft and revalidates id-scoped tags", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.updatePlaylistById).mockResolvedValueOnce(
        makeLean({
          _id: { toString: () => "playlist123456789012" },
          status: "draft",
        }),
      );

      await service.unpublishPlaylist("playlist123456789012");

      expect(revalidateTag).toHaveBeenCalledWith(PLAYLISTS_HOME, "default");
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistTag("playlist123456789012"),
        "default",
      );
    });
  });

  describe("deletePlaylist", () => {
    it("requires admin session, finds by id, deletes, and revalidates", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.findPlaylistById).mockResolvedValueOnce(
        makeLean({ _id: { toString: () => "playlist123456789012" } }),
      );
      vi.mocked(repo.deletePlaylistById).mockResolvedValueOnce(true);

      await service.deletePlaylist("playlist123456789012");

      expect(repo.findPlaylistById).toHaveBeenCalledWith("playlist123456789012");
      expect(repo.deletePlaylistById).toHaveBeenCalledWith("playlist123456789012");
      expect(revalidateTag).toHaveBeenCalledWith(PLAYLISTS_HOME, "default");
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistTag("playlist123456789012"),
        "default",
      );
    });

    it("throws NotFound when the playlist does not exist", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.findPlaylistById).mockResolvedValueOnce(null);

      await expect(service.deletePlaylist("missing")).rejects.toBeInstanceOf(AppError);
      expect(repo.deletePlaylistById).not.toHaveBeenCalled();
    });
  });

  describe("getAllPlaylists", () => {
    it("rejects non-admin callers with Forbidden", async () => {
      await expect(
        service.getAllPlaylists({ user: { role: "user" } } as never),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repo.findAllPlaylists).not.toHaveBeenCalled();
    });

    it("returns DTOs for admin caller", async () => {
      vi.mocked(repo.findAllPlaylists).mockResolvedValueOnce([makeLean()]);

      const result = await service.getAllPlaylists({
        user: { role: "admin" },
      } as never);

      expect(result).toHaveLength(1);
      expect(result[0]!.ar.title).toBe("عنوان");
    });
  });

  describe("getPlaylistById", () => {
    it("rejects non-admin callers with Forbidden", async () => {
      await expect(
        service.getPlaylistById("id", { user: { role: "user" } } as never),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("returns null when not found", async () => {
      vi.mocked(repo.findPlaylistById).mockResolvedValueOnce(null);

      const result = await service.getPlaylistById("missing", {
        user: { role: "admin" },
      } as never);

      expect(result).toBeNull();
    });
  });

  describe("reorderPlaylists", () => {
    it("requires admin session, calls updatePlaylistOrder, and revalidates home tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.updatePlaylistOrder).mockResolvedValueOnce(undefined);

      await service.reorderPlaylists(["playlist123456789012", "playlist123456789013"]);

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      expect(repo.updatePlaylistOrder).toHaveBeenCalledWith([
        "playlist123456789012",
        "playlist123456789013",
      ]);
      expect(revalidateTag).toHaveBeenCalledWith(PLAYLISTS_HOME, "default");
    });

    it("does not call updatePlaylistOrder when requireSession rejects", async () => {
      vi.mocked(requireSession).mockRejectedValueOnce(new AppError("UNAUTHORIZED", "Not authenticated"));

      await expect(
        service.reorderPlaylists(["playlist123456789012"]),
      ).rejects.toBeInstanceOf(AppError);
      expect(repo.updatePlaylistOrder).not.toHaveBeenCalled();
    });
  });

  describe("updatePlaylist", () => {
    it("forwards a scholarName-only patch and revalidates after the update", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.updatePlaylistById).mockResolvedValueOnce(
        makeLean({
          _id: { toString: () => "playlist123456789012" },
          ar: { title: "عنوان", slug: "عنوان", scholarName: "جديد" },
        }),
      );

      await service.updatePlaylist("playlist123456789012", {
        ar: { scholarName: "جديد" },
      });

      // The service forwards the partial patch untouched; flattenLocaleUpdate
      // (covered by mongo-update.test.ts) merges it into "ar.scholarName" so
      // sibling fields like slug survive.
      expect(repo.updatePlaylistById).toHaveBeenCalledWith(
        "playlist123456789012",
        expect.objectContaining({ ar: { scholarName: "جديد" } }),
      );
      expect(revalidateTag).toHaveBeenCalledWith(PLAYLISTS_HOME, "default");
    });

    it("forwards a soundcloudUrl patch (and accepts null to clear it)", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as never);
      vi.mocked(repo.updatePlaylistById).mockResolvedValueOnce(
        makeLean({ _id: { toString: () => "playlist123456789012" } }),
      );

      await service.updatePlaylist("playlist123456789012", {
        soundcloudUrl: null,
      });

      expect(repo.updatePlaylistById).toHaveBeenCalledWith(
        "playlist123456789012",
        expect.objectContaining({ soundcloudUrl: null }),
      );
    });
  });
});
