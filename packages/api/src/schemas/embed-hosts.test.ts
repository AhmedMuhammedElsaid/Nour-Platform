import { describe, expect, it } from "vitest";

import {
  EMBED_CSP_FRAME_SRC,
  findEmbedProvider,
} from "@repo/config/embed-hosts";

describe("embed-hosts allow-list", () => {
  it("matches soundcloud.com (and subdomains) as the oembed provider", () => {
    expect(findEmbedProvider("https://soundcloud.com/u/sets/x")?.mode).toBe(
      "soundcloud-oembed",
    );
    expect(findEmbedProvider("https://m.soundcloud.com/u/t")?.id).toBe(
      "soundcloud",
    );
  });

  it("matches amgadsamir.com (apex and www) as the direct-iframe provider", () => {
    expect(findEmbedProvider("https://amgadsamir.com/series/x")?.mode).toBe(
      "direct-iframe",
    );
    expect(
      findEmbedProvider("https://www.amgadsamir.com/series/x")?.id,
    ).toBe("amgadsamir");
  });

  it("returns null for an off-list domain or an unparseable URL", () => {
    expect(findEmbedProvider("https://evil.example.com/x")).toBeNull();
    // a look-alike suffix must not match (notsoundcloud.com)
    expect(findEmbedProvider("https://notsoundcloud.com/x")).toBeNull();
    expect(findEmbedProvider("not a url")).toBeNull();
  });

  it("exposes a deduplicated CSP frame-src list covering every provider", () => {
    expect(EMBED_CSP_FRAME_SRC).toContain("https://w.soundcloud.com");
    expect(EMBED_CSP_FRAME_SRC).toContain("https://amgadsamir.com");
    expect(EMBED_CSP_FRAME_SRC).toContain("https://*.amgadsamir.com");
    // no duplicates
    expect(new Set(EMBED_CSP_FRAME_SRC).size).toBe(EMBED_CSP_FRAME_SRC.length);
  });
});
