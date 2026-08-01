import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth/require-session", () => ({ requireSession: vi.fn() }));

// Recording next/cache mock — see playlist.service.test.ts for why a
// call-through-only mock would be vacuous here.
const cacheMock = vi.hoisted(() => {
  const calls: Array<{
    keyParts: readonly string[];
    tags: readonly string[];
    revalidate: unknown;
  }> = [];
  return {
    calls,
    unstable_cache: (
      cb: () => Promise<unknown>,
      keyParts: readonly string[],
      opts: { tags: readonly string[]; revalidate: unknown },
    ) => {
      calls.push({ keyParts, tags: opts.tags, revalidate: opts.revalidate });
      return cb;
    },
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: cacheMock.unstable_cache,
}));
vi.mock("../repositories/azkar.repo", () => ({
  findPublishedAzkar: vi.fn(),
  findAllAzkar: vi.fn(),
  findAzkarBySlug: vi.fn(),
  findAzkarById: vi.fn(),
  createAzkar: vi.fn(),
  updateAzkarById: vi.fn(),
  deleteAzkarById: vi.fn(),
  updateAzkarOrder: vi.fn(),
}));
vi.mock("../db/models/azkar.model", () => ({
  AzkarModel: { countDocuments: vi.fn().mockResolvedValue(0) },
}));

import { requireSession } from "../auth/require-session";
import { revalidateTag } from "next/cache";
import { ADHKAR } from "../cache/tags";
import * as repo from "../repositories/azkar.repo";
import {
  getPublishedAzkar,
  getAzkarBySlug,
  getAllAzkar,
  getAzkarById,
  createAzkar,
  updateAzkar,
  deleteAzkar,
  publishAzkar,
  unpublishAzkar,
  reorderAzkar,
} from "./azkar.service";

const lean = {
  _id: { toString: () => "a1" },
  kind: "morning",
  status: "published",
  order: 0,
  ar: { title: "أذكار الصباح", slug: "azkar-alsabah" },
  en: { title: "Morning", slug: "morning" },
  items: [{ ar: "سبحان الله", repeat: 3 }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  cacheMock.calls.length = 0;
});

describe("azkar.service cache activation", () => {
  it("keys getPublishedAzkar constantly and tags it ADHKAR", async () => {
    vi.mocked(repo.findPublishedAzkar).mockResolvedValue([] as never);
    await getPublishedAzkar();
    expect(cacheMock.calls).toHaveLength(1);
    expect(cacheMock.calls[0]).toMatchObject({
      keyParts: ["azkar", "published"],
      tags: [ADHKAR],
    });
  });

  it("keys getAzkarBySlug by BOTH locale and slug", async () => {
    vi.mocked(repo.findAzkarBySlug).mockResolvedValue(lean as never);
    await getAzkarBySlug("ar", "azkar-alsabah");
    await getAzkarBySlug("en", "azkar-alsabah");
    expect(cacheMock.calls[0]).toMatchObject({
      keyParts: ["azkar", "by-slug", "ar", "azkar-alsabah"],
      tags: [ADHKAR],
    });
    // Same slug, different locale — must not collide.
    expect(cacheMock.calls[0]!.keyParts).not.toEqual(cacheMock.calls[1]!.keyParts);
  });

  it("every tag the cached reads subscribe to is emitted by the mutations", async () => {
    // Same coupling check as playlist.service.test.ts: a read subscribing to a
    // tag no mutation emits would go stale for a full TTL, undetected.
    vi.mocked(repo.findPublishedAzkar).mockResolvedValue([] as never);
    vi.mocked(repo.findAzkarBySlug).mockResolvedValue(lean as never);
    await getPublishedAzkar();
    await getAzkarBySlug("ar", "azkar-alsabah");
    const subscribed = new Set(cacheMock.calls.flatMap((c) => c.tags));
    expect(subscribed.size).toBeGreaterThan(0);

    for (const mutate of [
      () => publishAzkar("a1"),
      () => unpublishAzkar("a1"),
      () => updateAzkar("a1", { order: 1 }),
    ]) {
      vi.mocked(revalidateTag).mockClear();
      vi.mocked(repo.updateAzkarById).mockResolvedValue(lean as never);
      await mutate();
      const emitted = new Set(vi.mocked(revalidateTag).mock.calls.map((c) => c[0]));
      for (const tag of subscribed) expect(emitted).toContain(tag);
    }
  });

  it("does NOT cache the draft-exposing admin reads", async () => {
    vi.mocked(repo.findAllAzkar).mockResolvedValue([lean] as never);
    vi.mocked(repo.findAzkarById).mockResolvedValue(lean as never);
    await getAllAzkar({ user: { role: "admin" } } as never);
    await getAzkarById("a1", { user: { role: "admin" } } as never);
    expect(cacheMock.calls).toHaveLength(0);
  });
});

describe("azkar.service reads", () => {
  it("getPublishedAzkar maps DTOs", async () => {
    vi.mocked(repo.findPublishedAzkar).mockResolvedValue([lean] as never);
    const result = await getPublishedAzkar();
    expect(result[0]?.id).toBe("a1");
    expect(result[0]?.items[0]?.repeat).toBe(3);
  });

  it("getAzkarBySlug throws NotFound when missing", async () => {
    vi.mocked(repo.findAzkarBySlug).mockResolvedValue(null);
    await expect(getAzkarBySlug("ar", "nope")).rejects.toThrow(/not found/i);
  });
});

describe("azkar.service admin reads", () => {
  it("getAllAzkar throws Forbidden for non-admin", async () => {
    await expect(
      getAllAzkar({ user: { role: "user" } } as never),
    ).rejects.toThrow(/forbidden|role/i);
  });

  it("getAzkarById returns null when not found", async () => {
    vi.mocked(repo.findAzkarById).mockResolvedValue(null);
    const result = await getAzkarById("x1", { user: { role: "admin" } } as never);
    expect(result).toBeNull();
  });
});

describe("azkar.service mutations", () => {
  it("createAzkar requires admin session and auto-slugs", async () => {
    vi.mocked(repo.createAzkar).mockResolvedValue(lean as never);
    await createAzkar({
      kind: "morning",
      ar: { title: "أذكار الصباح" },
      en: { title: "Morning Adhkar" },
      items: [{ ar: "سبحان الله", repeat: 3 }],
    });
    expect(requireSession).toHaveBeenCalledWith(["admin"]);
  });

  it("createAzkar rejects empty items via zod", async () => {
    await expect(
      createAzkar({
        kind: "morning",
        ar: { title: "x" },
        en: { title: "y" },
        items: [],
      } as never),
    ).rejects.toThrow();
  });

  it("updateAzkar throws NotFound when repo returns null", async () => {
    vi.mocked(repo.updateAzkarById).mockResolvedValue(null);
    await expect(updateAzkar("a1", { status: "published" })).rejects.toThrow(
      /not found/i,
    );
  });

  it("publishAzkar revalidates tags", async () => {
    vi.mocked(repo.updateAzkarById).mockResolvedValue(lean as never);
    await publishAzkar("a1");
    expect(revalidateTag).toHaveBeenCalledWith("adhkar", "default");
    expect(revalidateTag).toHaveBeenCalledWith("azkar:a1", "default");
  });

  it("deleteAzkar requires existing doc", async () => {
    vi.mocked(repo.findAzkarById).mockResolvedValue(null);
    await expect(deleteAzkar("missing")).rejects.toThrow(/not found/i);
  });

  it("unpublishAzkar sets draft and revalidates", async () => {
    vi.mocked(repo.updateAzkarById).mockResolvedValue(lean as never);
    await unpublishAzkar("a1");
    expect(repo.updateAzkarById).toHaveBeenCalledWith("a1", { status: "draft" });
    expect(revalidateTag).toHaveBeenCalledWith("adhkar", "default");
  });

  it("reorderAzkar checks session + revalidates", async () => {
    await reorderAzkar(["a1", "a2"]);
    expect(requireSession).toHaveBeenCalledWith(["admin"]);
    expect(repo.updateAzkarOrder).toHaveBeenCalledWith(["a1", "a2"]);
    expect(revalidateTag).toHaveBeenCalledWith("adhkar", "default");
  });
});
