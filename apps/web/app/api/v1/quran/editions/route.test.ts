import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/quran", () => ({ listEditions: vi.fn() }));

const { listEditions } = await import("@repo/api/services/quran");
const { GET, OPTIONS } = await import("./route");

describe("GET /api/v1/quran/editions", () => {
  it("returns the edition list", async () => {
    vi.mocked(listEditions).mockResolvedValueOnce([
      { slug: "en.sahih", language: "en", name: "Sahih International", author: "x", type: "translation", dir: "ltr" },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body[0].slug).toBe("en.sahih");
  });

  it("answers OPTIONS preflight", () => {
    expect(OPTIONS().status).toBe(204);
  });
});
