import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors";

// Hoisted so the vi.mock factory can close over the same object we mutate
// per-test (media.service reads env.R2_PUBLIC_BASE at call time).
const { env } = vi.hoisted(() => ({
  env: { R2_PUBLIC_BASE: undefined as string | undefined },
}));

vi.mock("@repo/config/env", () => ({ env }));
vi.mock("../auth/require-session", () => ({ requireSession: vi.fn() }));
vi.mock("../media/r2-client", () => ({ headObject: vi.fn() }));
vi.mock("../repositories/media.repo", () => ({
  createMedia: vi.fn(),
  findMediaById: vi.fn(),
  updateMediaById: vi.fn(),
}));

const { requireSession } = await import("../auth/require-session");
const r2 = await import("../media/r2-client");
const repo = await import("../repositories/media.repo");
const service = await import("./media.service");

function mediaLean(overrides: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => "m1" },
    key: "uploads/foo.mp3",
    bucket: "media",
    mimeType: "audio/mpeg",
    sizeBytes: 1024,
    status: "pending",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  env.R2_PUBLIC_BASE = undefined;
});

describe("media.service", () => {
  describe("getMediaUrlById", () => {
    it("returns null (and skips the DB read) when R2_PUBLIC_BASE is unset", async () => {
      const url = await service.getMediaUrlById("m1");
      expect(url).toBeNull();
      expect(repo.findMediaById).not.toHaveBeenCalled();
    });

    it("builds `${base}/${key}` when configured and the media exists", async () => {
      env.R2_PUBLIC_BASE = "https://cdn.test";
      vi.mocked(repo.findMediaById).mockResolvedValueOnce(
        mediaLean({ key: "audio/cover-1.jpg" }),
      );

      const url = await service.getMediaUrlById("m1");

      expect(url).toBe("https://cdn.test/audio/cover-1.jpg");
    });

    it("returns null when the media record is missing", async () => {
      env.R2_PUBLIC_BASE = "https://cdn.test";
      vi.mocked(repo.findMediaById).mockResolvedValueOnce(null as any);

      const url = await service.getMediaUrlById("m1");

      expect(url).toBeNull();
    });
  });

  describe("createMedia", () => {
    it("requires admin session and inserts a pending Media", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.createMedia).mockResolvedValueOnce(mediaLean());

      const result = await service.createMedia({
        key: "uploads/foo.mp3",
        bucket: "media",
        mimeType: "audio/mpeg",
        sizeBytes: 1024,
        uploadedBy: "u1",
      });

      expect(requireSession).toHaveBeenCalledWith(["admin"]);
      expect(vi.mocked(repo.createMedia).mock.calls[0]![0].status).toBe(
        "pending",
      );
      expect(result.id).toBe("m1");
      expect(result.status).toBe("pending");
    });
  });

  describe("confirmMedia", () => {
    it("flips status to confirmed when the R2 object exists and matches", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findMediaById).mockResolvedValueOnce(mediaLean());
      vi.mocked(r2.headObject).mockResolvedValueOnce({
        contentLength: 1024,
        contentType: "audio/mpeg",
      } as any);
      vi.mocked(repo.updateMediaById).mockResolvedValueOnce(
        mediaLean({ status: "confirmed" }),
      );

      const result = await service.confirmMedia("m1");

      expect(repo.updateMediaById).toHaveBeenCalledWith("m1", {
        status: "confirmed",
      });
      expect(result.status).toBe("confirmed");
    });

    it("throws Validation when the R2 object is missing", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findMediaById).mockResolvedValueOnce(mediaLean());
      vi.mocked(r2.headObject).mockResolvedValueOnce(null);

      await expect(service.confirmMedia("m1")).rejects.toMatchObject({
        code: "VALIDATION",
      });
      expect(repo.updateMediaById).not.toHaveBeenCalled();
    });

    it("throws Validation when the uploaded size does not match the record", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findMediaById).mockResolvedValueOnce(mediaLean());
      vi.mocked(r2.headObject).mockResolvedValueOnce({
        contentLength: 999_999_999,
        contentType: "audio/mpeg",
      } as any);

      await expect(service.confirmMedia("m1")).rejects.toMatchObject({
        code: "VALIDATION",
      });
      expect(repo.updateMediaById).not.toHaveBeenCalled();
    });

    it("throws Validation when the uploaded mime type does not match the record", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findMediaById).mockResolvedValueOnce(mediaLean());
      vi.mocked(r2.headObject).mockResolvedValueOnce({
        contentLength: 1024,
        contentType: "application/octet-stream",
      } as any);

      await expect(service.confirmMedia("m1")).rejects.toMatchObject({
        code: "VALIDATION",
      });
      expect(repo.updateMediaById).not.toHaveBeenCalled();
    });

    it("throws Validation when Media is not in pending state", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findMediaById).mockResolvedValueOnce(
        mediaLean({ status: "confirmed" }),
      );

      await expect(service.confirmMedia("m1")).rejects.toBeInstanceOf(AppError);
      expect(r2.headObject).not.toHaveBeenCalled();
    });

    it("throws NotFound when Media id is unknown", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce({} as any);
      vi.mocked(repo.findMediaById).mockResolvedValueOnce(null as any);

      await expect(service.confirmMedia("missing")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});
