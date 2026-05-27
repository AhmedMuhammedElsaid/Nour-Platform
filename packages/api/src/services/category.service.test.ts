import { beforeEach, describe, expect, it, vi } from "vitest";

import { categoriesTag, playlistsHomeTag } from "../cache/tags";
import { AppError } from "../errors";

// Module-level mocks. Hoisted by vitest before service import.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("../auth/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("../repositories/category.repo", () => ({
  create: vi.fn(),
  deleteById: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  findByContentId: vi.fn(),
  findBySlug: vi.fn(),
  updateById: vi.fn(),
}));

// PlaylistModel is referenced directly in deleteCategory for the $pull cascade.
vi.mock("../db/models/playlist.model", () => ({
  PlaylistModel: {
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  },
}));

// getDb is called by the service inside deleteCategory.
vi.mock("../db/client", () => ({
  getDb: vi.fn().mockResolvedValue(undefined),
}));

const { revalidateTag } = await import("next/cache");
const { requireSession } = await import("../auth/require-session");
const repo = await import("../repositories/category.repo");
const { PlaylistModel } = await import("../db/models/playlist.model");
const service = await import("./category.service");

function makeLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => "c1" },
    contentId: "cc1",
    locale: "ar",
    name: "Quran",
    slug: "quran",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("category.service", () => {
  // ── Public reads ────────────────────────────────────────────────────────────

  describe("listCategories", () => {
    it("passes the locale to the repo and maps to DTOs", async () => {
      vi.mocked(repo.findAll).mockResolvedValueOnce([
        makeLean({ slug: "alpha", _id: { toString: () => "aaa" } }),
        makeLean({ slug: "beta", _id: { toString: () => "bbb" } }),
      ]);

      const result = await service.listCategories("ar");

      expect(repo.findAll).toHaveBeenCalledWith("ar");
      expect(result).toHaveLength(2);
      expect(result[0]!.slug).toBe("alpha");
      expect(result[0]!.id).toBe("aaa");
      expect(result[0]!.locale).toBe("ar");
      expect(requireSession).not.toHaveBeenCalled();
    });

    it("returns an empty array when no categories exist", async () => {
      vi.mocked(repo.findAll).mockResolvedValueOnce([]);

      const result = await service.listCategories("en");

      expect(result).toHaveLength(0);
    });
  });

  describe("getCategoryBySlug", () => {
    it("passes locale + slug and returns the category DTO when found", async () => {
      vi.mocked(repo.findBySlug).mockResolvedValueOnce(
        makeLean({ slug: "quran", name: "Quran" }),
      );

      const result = await service.getCategoryBySlug("ar", "quran");

      expect(repo.findBySlug).toHaveBeenCalledWith("ar", "quran");
      expect(result.slug).toBe("quran");
      expect(result.name).toBe("Quran");
      expect(result.id).toBe("c1");
      expect(requireSession).not.toHaveBeenCalled();
    });

    it("throws AppError NOT_FOUND when findBySlug returns null", async () => {
      vi.mocked(repo.findBySlug).mockResolvedValue(null);

      await expect(
        service.getCategoryBySlug("ar", "missing"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  // ── Admin mutations ─────────────────────────────────────────────────────────

  describe("createCategory", () => {
    it("happy path: auto-derives slug, mints contentId, revalidates locale tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.create).mockResolvedValueOnce(
        makeLean({ name: "My Category", slug: "my-category" }),
      );

      const result = await service.createCategory({
        locale: "ar",
        name: "My Category!",
      });

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      const createArg = vi.mocked(repo.create).mock.calls[0]![0];
      expect(createArg.slug).toBe("my-category");
      expect(createArg.contentId).toMatch(/^[0-9a-f]{24}$/);
      expect(result.slug).toBe("my-category");
      expect(result.name).toBe("My Category");
      expect(revalidateTag).toHaveBeenCalledWith(categoriesTag("ar"), "default");
    });

    it("uses caller-supplied slug when one is provided", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.create).mockResolvedValueOnce(
        makeLean({ name: "Custom", slug: "custom-slug" }),
      );

      await service.createCategory({
        locale: "ar",
        name: "Custom",
        slug: "custom-slug",
      });

      expect(vi.mocked(repo.create).mock.calls[0]![0].slug).toBe("custom-slug");
    });

    it("slug collision (code 11000) appends -2 suffix and retries once", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      // First call throws a Mongo duplicate-key error.
      vi.mocked(repo.create)
        .mockRejectedValueOnce({ code: 11000 })
        .mockResolvedValueOnce(makeLean({ name: "Quran", slug: "quran-2" }));

      const result = await service.createCategory({ locale: "ar", name: "Quran" });

      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(vi.mocked(repo.create).mock.calls[1]![0].slug).toBe("quran-2");
      expect(result.slug).toBe("quran-2");
    });

    it("throws AppError when a non-admin session is used", async () => {
      vi.mocked(requireSession).mockRejectedValueOnce(
        AppError.Forbidden(["admin"]),
      );

      await expect(
        service.createCategory({ locale: "ar", name: "Test" }),
      ).rejects.toBeInstanceOf(AppError);

      expect(repo.create).not.toHaveBeenCalled();
    });

    it("throws ZodError when input is invalid", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);

      await expect(
        service.createCategory({ name: "" } as any),
      ).rejects.toThrow();

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("updateCategory", () => {
    it("happy path: calls updateById, revalidates the locale tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.updateById).mockResolvedValueOnce(
        makeLean({ name: "Sunnah", slug: "sunnah" }),
      );

      const result = await service.updateCategory("c1", { name: "Sunnah" });

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      expect(repo.updateById).toHaveBeenCalledWith("c1", { name: "Sunnah" });
      expect(result.name).toBe("Sunnah");
      expect(revalidateTag).toHaveBeenCalledWith(categoriesTag("ar"), "default");
    });

    it("throws AppError NOT_FOUND when updateById returns null", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.updateById).mockResolvedValueOnce(null);

      await expect(
        service.updateCategory("missing", { name: "X" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(revalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("deleteCategory", () => {
    it("pulls the contentId from playlists when the last locale is gone", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findById).mockResolvedValueOnce(makeLean());
      vi.mocked(repo.deleteById).mockResolvedValueOnce(true);
      // No surviving locale variant → cascade fires.
      vi.mocked(repo.findByContentId).mockResolvedValueOnce(null);

      await service.deleteCategory("c1");

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      expect(repo.deleteById).toHaveBeenCalledWith("c1");
      expect(vi.mocked(PlaylistModel.updateMany)).toHaveBeenCalledWith(
        { categoryIds: "cc1" },
        { $pull: { categoryIds: "cc1" } },
      );
      expect(revalidateTag).toHaveBeenCalledWith(categoriesTag("ar"), "default");
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistsHomeTag("ar"),
        "default",
      );
      expect(revalidateTag).toHaveBeenCalledWith(
        playlistsHomeTag("en"),
        "default",
      );
    });

    it("skips the playlist cascade when another locale variant survives", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findById).mockResolvedValueOnce(makeLean());
      vi.mocked(repo.deleteById).mockResolvedValueOnce(true);
      // A surviving variant (e.g. the English category) → no pull.
      vi.mocked(repo.findByContentId).mockResolvedValueOnce(
        makeLean({ locale: "en" }),
      );

      await service.deleteCategory("c1");

      expect(PlaylistModel.updateMany).not.toHaveBeenCalled();
      expect(revalidateTag).toHaveBeenCalledWith(categoriesTag("ar"), "default");
    });

    it("throws AppError NOT_FOUND when deleteById returns false", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findById).mockResolvedValueOnce(makeLean());
      vi.mocked(repo.deleteById).mockResolvedValueOnce(false);

      await expect(service.deleteCategory("missing")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      expect(PlaylistModel.updateMany).not.toHaveBeenCalled();
    });

    it("throws AppError when a non-admin session is used", async () => {
      vi.mocked(requireSession).mockRejectedValueOnce(
        AppError.Forbidden(["admin"]),
      );

      await expect(service.deleteCategory("c1")).rejects.toBeInstanceOf(
        AppError,
      );

      expect(repo.deleteById).not.toHaveBeenCalled();
    });
  });
});
