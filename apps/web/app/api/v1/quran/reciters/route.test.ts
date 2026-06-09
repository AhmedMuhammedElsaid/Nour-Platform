import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/quran", () => ({ listReciters: vi.fn() }));

const { listReciters } = await import("@repo/api/services/quran");
const { GET, OPTIONS } = await import("./route");

describe("GET /api/v1/quran/reciters", () => {
  it("returns the reciter list", async () => {
    vi.mocked(listReciters).mockResolvedValueOnce([
      { slug: "alafasy", name: "Mishary Alafasy", audioBase: "https://everyayah.com/data/Alafasy_128kbps/" },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body[0].slug).toBe("alafasy");
  });

  it("answers OPTIONS preflight", () => {
    expect(OPTIONS().status).toBe(204);
  });
});
