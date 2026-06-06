import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSoundCloudEmbedSrc } from "./soundcloud-oembed";

const PLAYER_SRC =
  "https://w.soundcloud.com/player/?visual=true&url=https%3A%2F%2Fapi.soundcloud.com%2Fusers%2F108832165&show_artwork=true";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchSoundCloudEmbedSrc", () => {
  it("extracts the w.soundcloud.com player src from the oEmbed html", async () => {
    mockFetchOnce({ html: `<iframe src="${PLAYER_SRC}"></iframe>` });

    const src = await fetchSoundCloudEmbedSrc(
      "https://soundcloud.com/amgad_samir_abu_mohannad/tracks",
    );

    expect(src).toBe(PLAYER_SRC);
  });

  it("requests oEmbed with the original URL and a properly-encoded gold colour", async () => {
    const fn = mockFetchOnce({ html: `<iframe src="${PLAYER_SRC}"></iframe>` });

    await fetchSoundCloudEmbedSrc("https://soundcloud.com/u/sets/x");

    const requested = String(fn.mock.calls[0]![0]);
    // color must be single-encoded (%23C8A050), not double-encoded (%2523...)
    expect(requested).toContain("color=%23C8A050");
    expect(requested).not.toContain("%2523");
    expect(requested).toContain(encodeURIComponent("https://soundcloud.com/u/sets/x"));
  });

  it("decodes HTML entities in the src (&amp; → &)", async () => {
    mockFetchOnce({
      html: `<iframe src="https://w.soundcloud.com/player/?a=1&amp;b=2"></iframe>`,
    });

    const src = await fetchSoundCloudEmbedSrc("https://soundcloud.com/u/t");

    expect(src).toBe("https://w.soundcloud.com/player/?a=1&b=2");
  });

  it("returns null on a non-ok response", async () => {
    mockFetchOnce({}, false, 404);
    expect(await fetchSoundCloudEmbedSrc("https://soundcloud.com/u/t")).toBeNull();
  });

  it("returns null when the html field is missing", async () => {
    mockFetchOnce({ version: 1 });
    expect(await fetchSoundCloudEmbedSrc("https://soundcloud.com/u/t")).toBeNull();
  });

  it("rejects a src whose host is not w.soundcloud.com (defense in depth)", async () => {
    mockFetchOnce({ html: `<iframe src="https://evil.example.com/player"></iframe>` });
    expect(await fetchSoundCloudEmbedSrc("https://soundcloud.com/u/t")).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await fetchSoundCloudEmbedSrc("https://soundcloud.com/u/t")).toBeNull();
  });
});
