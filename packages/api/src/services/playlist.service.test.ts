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
}));

vi.mock("../repositories/category.repo", () => ({
  findById: vi.fn(),
}));

const { revalidateTag } = await import("next/cache");
const { requireSession } = await import("../auth/require-session");
const repo = await import("../repositories/playlist.repo");
const service = await import("./playlist.service");

function makeLean(overrides: Record<string, unknown> = {}): {
  _id: { toString: () => string };
  ar: { title: string; slug: string; description?: string };
  en: { title: string; slug: string; description?: string };
  coverMediaId: null;
  status: string;
  categoryIds: never[];
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    _id: { toString: () => "playlist123456789012" },
    ar: { title: "عنوان", slug: "عنوان" },
    en: { title: "Title", slug: "title" },
    coverMediaId: null,
    status: "draft",
    categoryIds: [],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  } as ReturnType<typeof makeLean>;
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
});
