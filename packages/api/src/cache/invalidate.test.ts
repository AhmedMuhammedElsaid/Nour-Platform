import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above imports, so anything they reference must
// be created via vi.hoisted (a plain outer const is referenced before init).
const { revalidateTag, envState } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  envState: {} as { WEB_REVALIDATE_URL?: string; REVALIDATE_SECRET?: string },
}));
vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@repo/config/env", () => ({ env: envState }));

import { invalidate } from "./invalidate";

describe("invalidate", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
    delete envState.WEB_REVALIDATE_URL;
    delete envState.REVALIDATE_SECRET;
    vi.unstubAllGlobals();
  });

  it("revalidates every tag locally", async () => {
    await invalidate(["playlists:home", "playlist:abc"]);
    expect(revalidateTag).toHaveBeenCalledWith("playlists:home", "default");
    expect(revalidateTag).toHaveBeenCalledWith("playlist:abc", "default");
  });

  it("POSTs the tags to the web revalidate webhook when configured", async () => {
    envState.WEB_REVALIDATE_URL = "https://web.example/api/revalidate";
    envState.REVALIDATE_SECRET = "0123456789abcdef";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await invalidate(["playlists:home"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://web.example/api/revalidate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-revalidate-secret": "0123456789abcdef",
        }),
        body: JSON.stringify({ tags: ["playlists:home"] }),
      }),
    );
  });

  it("swallows webhook failures (cache TTL self-heals)", async () => {
    envState.WEB_REVALIDATE_URL = "https://web.example/api/revalidate";
    envState.REVALIDATE_SECRET = "0123456789abcdef";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));

    await expect(invalidate(["playlists:home"])).resolves.toBeUndefined();
  });

  it("skips the webhook when env is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await invalidate(["playlists:home"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
