import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/azkar", () => ({ getPublishedAzkar: vi.fn() }));

const { getPublishedAzkar } = await import("@repo/api/services/azkar");
const { GET, OPTIONS } = await import("./route");

describe("GET /api/v1/adhkar", () => {
  it("returns adhkar list with embedded ar+en", async () => {
    vi.mocked(getPublishedAzkar).mockResolvedValueOnce([
      {
        id: "z1",
        kind: "morning",
        status: "published",
        order: 0,
        ar: { title: "أذكار الصباح", slug: "morning" },
        en: { title: "Morning", slug: "morning" },
        items: [],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body[0].ar.title).toBe("أذكار الصباح");
    expect(body[0].en.title).toBe("Morning");
  });

  it("answers OPTIONS preflight", () => {
    expect(OPTIONS().status).toBe(204);
  });
});
