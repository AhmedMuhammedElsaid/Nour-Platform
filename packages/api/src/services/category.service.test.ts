import { beforeEach, describe, expect, it, vi } from "vitest";

import { CATEGORIES, PLAYLISTS_HOME } from "../cache/tags";
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

const mockId = { toString: () => "cat1234567890123456" };

function makeLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: mockId,
    ar: { name: "فئة", slug: "فئة" },
    en: { name: "Category", slug: "category" },
    coverMediaId: null,
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
    it("calls findAll with no args and maps to DTOs", async () => {
      vi.mocked(repo.findAll).mockResolvedValueOnce([
        makeLean({ ar: { name: "ألفا", slug: "alpha-ar" }, en: { name: "Alpha", slug: "alpha" }, _id: { toString: () => "aaa" } }),
        makeLean({ ar: { name: "بيتا", slug: "beta-ar" }, en: { name: "Beta", slug: "beta" }, _id: { toString: () => "bbb" } }),
      ]);

      const result = await service.listCategories();

      expect(repo.findAll).toHaveBeenCalledWith();
      expect(result).toHaveLength(2);
      expect(result[0]!.ar.slug).toBe("alpha-ar");
      expect(result[0]!.en.slug).toBe("alpha");
      expect(result[0]!.id).toBe("aaa");
      expect(requireSession).not.toHaveBeenCalled();
    });

    it("returns an empty array when no categories exist", async () => {
      vi.mocked(repo.findAll).mockResolvedValueOnce([]);

      const result = await service.listCategories();

      expect(result).toHaveLength(0);
    });
  });

  describe("getCategoryBySlug", () => {
    it("passes locale + slug and returns the category DTO when found", async () => {
      vi.mocked(repo.findBySlug).mockResolvedValueOnce(
        makeLean({ ar: { name: "القرآن", slug: "quran-ar" }, en: { name: "Quran", slug: "quran" } }),
      );

      const result = await service.getCategoryBySlug("ar", "quran-ar");

      expect(repo.findBySlug).toHaveBeenCalledWith("ar", "quran-ar");
      expect(result.ar.slug).toBe("quran-ar");
      expect(result.en.name).toBe("Quran");
      expect(result.id).toBe("cat1234567890123456");
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
    it("happy path: auto-derives slugs, revalidates CATEGORIES tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.create).mockResolvedValueOnce(
        makeLean({
          ar: { name: "فئتي", slug: "my-category-ar" },
          en: { name: "My Category", slug: "my-category" },
        }),
      );

      const result = await service.createCategory({
        ar: { name: "فئتي!" },
        en: { name: "My Category!" },
      });

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      const createArg = vi.mocked(repo.create).mock.calls[0]![0];
      // Slug is auto-derived from ar.name and en.name
      expect(typeof createArg.ar.slug).toBe("string");
      expect(createArg.ar.slug.length).toBeGreaterThan(0);
      expect(typeof createArg.en.slug).toBe("string");
      expect(createArg.en.slug.length).toBeGreaterThan(0);
      expect(result.ar.name).toBe("فئتي");
      expect(result.en.name).toBe("My Category");
      expect(revalidateTag).toHaveBeenCalledWith(CATEGORIES, "default");
    });

    it("uses caller-supplied slugs when provided", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.create).mockResolvedValueOnce(
        makeLean({
          ar: { name: "مخصص", slug: "custom-slug-ar" },
          en: { name: "Custom", slug: "custom-slug" },
        }),
      );

      await service.createCategory({
        ar: { name: "مخصص", slug: "custom-slug-ar" },
        en: { name: "Custom", slug: "custom-slug" },
      });

      const createArg = vi.mocked(repo.create).mock.calls[0]![0];
      expect(createArg.ar.slug).toBe("custom-slug-ar");
      expect(createArg.en.slug).toBe("custom-slug");
    });

    it("slug collision (code 11000) appends -2 suffix and retries once", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      // First call throws a Mongo duplicate-key error.
      vi.mocked(repo.create)
        .mockRejectedValueOnce({ code: 11000 })
        .mockResolvedValueOnce(
          makeLean({ ar: { name: "القرآن", slug: "quran-ar-2" }, en: { name: "Quran", slug: "quran-2" } }),
        );

      const result = await service.createCategory({
        ar: { name: "القرآن" },
        en: { name: "Quran" },
      });

      expect(repo.create).toHaveBeenCalledTimes(2);
      // Second attempt uses suffix -2 on both slugs
      const secondCall = vi.mocked(repo.create).mock.calls[1]![0];
      expect(secondCall.ar.slug).toMatch(/-2$/);
      expect(secondCall.en.slug).toMatch(/-2$/);
      expect(result.ar.slug).toBe("quran-ar-2");
    });

    it("throws AppError when a non-admin session is used", async () => {
      vi.mocked(requireSession).mockRejectedValueOnce(
        AppError.Forbidden(["admin"]),
      );

      await expect(
        service.createCategory({ ar: { name: "اختبار" }, en: { name: "Test" } }),
      ).rejects.toBeInstanceOf(AppError);

      expect(repo.create).not.toHaveBeenCalled();
    });

    it("throws ZodError when input is invalid", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);

      await expect(
        service.createCategory({ ar: { name: "" }, en: { name: "" } } as any),
      ).rejects.toThrow();

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("updateCategory", () => {
    it("happy path: calls updateById, revalidates CATEGORIES tag", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.updateById).mockResolvedValueOnce(
        makeLean({ ar: { name: "السنة", slug: "sunnah-ar" }, en: { name: "Sunnah", slug: "sunnah" } }),
      );

      const result = await service.updateCategory("cat1234567890123456", { ar: { name: "السنة" } });

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      expect(repo.updateById).toHaveBeenCalledWith("cat1234567890123456", { ar: { name: "السنة" } });
      expect(result.en.name).toBe("Sunnah");
      expect(revalidateTag).toHaveBeenCalledWith(CATEGORIES, "default");
    });

    it("throws AppError NOT_FOUND when updateById returns null", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.updateById).mockResolvedValueOnce(null);

      await expect(
        service.updateCategory("missing", { ar: { name: "X" } }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(revalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("deleteCategory", () => {
    it("pulls the category _id from playlists and revalidates both tags", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findById).mockResolvedValueOnce(makeLean());
      vi.mocked(repo.deleteById).mockResolvedValueOnce(true);

      await service.deleteCategory("cat1234567890123456");

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      expect(repo.deleteById).toHaveBeenCalledWith("cat1234567890123456");
      // Cascade uses existing._id (the ObjectId object)
      expect(vi.mocked(PlaylistModel.updateMany)).toHaveBeenCalledWith(
        { categoryIds: mockId },
        { $pull: { categoryIds: mockId } },
      );
      expect(revalidateTag).toHaveBeenCalledWith(PLAYLISTS_HOME, "default");
      expect(revalidateTag).toHaveBeenCalledWith(CATEGORIES, "default");
    });

    it("throws AppError NOT_FOUND when the category does not exist", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findById).mockResolvedValueOnce(null);

      await expect(service.deleteCategory("missing")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      expect(repo.deleteById).not.toHaveBeenCalled();
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

      await expect(service.deleteCategory("cat1234567890123456")).rejects.toBeInstanceOf(
        AppError,
      );

      expect(repo.deleteById).not.toHaveBeenCalled();
    });
  });
});
