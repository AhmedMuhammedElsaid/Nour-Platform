import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveEmbed } from "./embed";

const OEMBED_SRC = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fusers%2F123";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(html: string | null, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 404,
      json: async () => (html ? { html: `<iframe src="${html}"></iframe>` } : {}),
    }),
  );
}

describe("resolveEmbed", () => {
  it("returns null for an off-list URL", async () => {
    expect(await resolveEmbed("https://evil.example.com/x")).toBeNull();
  });

  it("calls oEmbed and returns height 450 for a SoundCloud URL", async () => {
    mockFetch(OEMBED_SRC);
    const result = await resolveEmbed("https://soundcloud.com/u/sets/x");
    expect(result).not.toBeNull();
    expect(result!.src).toBe(OEMBED_SRC);
    expect(result!.height).toBe(450);
  });

  it("returns null when oEmbed resolution fails for SoundCloud", async () => {
    mockFetch(null, false);
    expect(await resolveEmbed("https://soundcloud.com/u/t")).toBeNull();
  });

  it("returns the URL directly at height 720 for a direct-iframe provider", async () => {
    const url = "https://www.amgadsamir.com/series/fahem-lazem-tathrar";
    const result = await resolveEmbed(url);
    expect(result).not.toBeNull();
    expect(result!.src).toBe(url);
    expect(result!.height).toBe(720);
  });

  it("does not call fetch for a direct-iframe provider", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await resolveEmbed("https://amgadsamir.com/series/x");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
