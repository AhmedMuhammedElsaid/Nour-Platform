import { describe, expect, it, vi } from "vitest";

// Passthrough mock: unstable_cache(fn, keyParts, opts) → fn. Lets us assert the
// wrapper forwards args to the underlying service (the cache layer itself is
// Next's concern, not ours to test).
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

const getPublishedPlaylists = vi.fn().mockResolvedValue([]);
const getPlaylistBySlug = vi.fn().mockResolvedValue(null);
vi.mock("@repo/api/services/playlist", () => ({
  getPublishedPlaylists: (...a: unknown[]) => getPublishedPlaylists(...a),
  getPlaylistBySlug: (...a: unknown[]) => getPlaylistBySlug(...a),
}));
const listCategories = vi.fn().mockResolvedValue([]);
vi.mock("@repo/api/services/category", () => ({
  listCategories: (...a: unknown[]) => listCategories(...a),
}));
const getTracksWithUrls = vi.fn().mockResolvedValue([]);
vi.mock("@repo/api/services/track", () => ({
  getTracksWithUrls: (...a: unknown[]) => getTracksWithUrls(...a),
}));

const {
  getCachedPublishedPlaylists,
  getCachedCategories,
  getCachedPlaylistBySlug,
  getCachedTracksWithUrls,
} = await import("./cached-content");

describe("cached-content wrappers forward to their services", () => {
  it("passes a categoryId filter through", async () => {
    await getCachedPublishedPlaylists("cat1");
    expect(getPublishedPlaylists).toHaveBeenCalledWith({ categoryId: "cat1" });
  });

  it("passes undefined when no category is given", async () => {
    await getCachedPublishedPlaylists();
    expect(getPublishedPlaylists).toHaveBeenCalledWith(undefined);
  });

  it("forwards locale + slug to getPlaylistBySlug", async () => {
    await getCachedPlaylistBySlug("ar", "fajr-lessons");
    expect(getPlaylistBySlug).toHaveBeenCalledWith("ar", "fajr-lessons");
  });

  it("forwards the playlist id to getTracksWithUrls", async () => {
    await getCachedTracksWithUrls("p1");
    expect(getTracksWithUrls).toHaveBeenCalledWith("p1");
  });

  it("calls listCategories", async () => {
    await getCachedCategories();
    expect(listCategories).toHaveBeenCalled();
  });
});
