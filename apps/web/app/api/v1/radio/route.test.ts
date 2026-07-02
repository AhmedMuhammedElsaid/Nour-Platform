import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/radio", () => ({ listStations: vi.fn() }));

const { listStations } = await import("@repo/api/services/radio");
const { GET, OPTIONS } = await import("./route");

const station = {
  id: "507f1f77bcf86cd799439011",
  slug: "quran-cairo",
  ar: { name: "إذاعة القرآن الكريم" },
  en: { name: "Holy Quran Radio" },
  country: "EG",
  city: "Cairo",
  streamUrl: "https://stream.radiojar.com/8s5u5tpdtwzuv",
  streamType: "mp3" as const,
  language: "ar",
  category: "quran" as const,
  isLive: true,
  isFeatured: true,
  order: 0,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

describe("GET /api/v1/radio", () => {
  it("returns stations with embedded ar+en and ISO dates", async () => {
    vi.mocked(listStations).mockResolvedValueOnce([station]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].ar.name).toBe("إذاعة القرآن الكريم");
    expect(body[0].en.name).toBe("Holy Quran Radio");
    expect(body[0].streamUrl).toBe("https://stream.radiojar.com/8s5u5tpdtwzuv");
    expect(body[0].createdAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("sets CORS + cache headers", async () => {
    vi.mocked(listStations).mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    expect(res.headers.get("cache-control")).toContain("max-age");
  });

  it("maps a service error to a JSON error response (no throw)", async () => {
    vi.mocked(listStations).mockRejectedValueOnce(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("INTERNAL");
  });

  it("answers OPTIONS preflight with CORS headers", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
