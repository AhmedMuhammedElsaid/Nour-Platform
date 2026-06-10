import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));

process.env.REVALIDATE_SECRET = "0123456789abcdef";
const { POST } = await import("./route");

function req(body: unknown, secret?: string) {
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers: secret ? { "x-revalidate-secret": secret } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => revalidateTag.mockReset());

  it("rejects a missing/wrong secret with 401", async () => {
    const res = await POST(req({ tags: ["playlists:home"] }, "wrong"));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates each tag and reports them back", async () => {
    const res = await POST(
      req({ tags: ["playlists:home", "categories"] }, "0123456789abcdef"),
    );
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("playlists:home", "default");
    expect(revalidateTag).toHaveBeenCalledWith("categories", "default");
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ tags: "not-an-array" }, "0123456789abcdef"));
    expect(res.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
