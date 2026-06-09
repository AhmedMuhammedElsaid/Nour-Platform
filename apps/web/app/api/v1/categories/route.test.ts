import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/category", () => ({ listCategories: vi.fn() }));

const { listCategories } = await import("@repo/api/services/category");
const { GET, OPTIONS } = await import("./route");

describe("GET /api/v1/categories", () => {
  it("returns categories with embedded ar+en", async () => {
    vi.mocked(listCategories).mockResolvedValueOnce([
      { id: "cat1", ar: { name: "ك", slug: "k" }, en: { name: "C", slug: "c" }, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01") },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body[0].ar.name).toBe("ك");
    expect(body[0].en.name).toBe("C");
    expect(typeof body[0].createdAt).toBe("string");
  });

  it("returns empty array", async () => {
    vi.mocked(listCategories).mockResolvedValueOnce([]);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("answers OPTIONS preflight", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
  });
});
