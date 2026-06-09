import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/azkar", () => ({ getAzkarBySlug: vi.fn() }));

const { getAzkarBySlug } = await import("@repo/api/services/azkar");
const { GET } = await import("./route");

function req(url: string): Request {
  return new Request(`http://localhost${url}`);
}
const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

const azkar = {
  id: "z1",
  kind: "morning" as const,
  status: "published" as const,
  order: 0,
  ar: { title: "أذكار الصباح", slug: "morning" },
  en: { title: "Morning", slug: "morning" },
  items: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("GET /api/v1/adhkar/:slug", () => {
  it("returns azkar for ar locale", async () => {
    vi.mocked(getAzkarBySlug).mockResolvedValueOnce(azkar);
    const res = await GET(req("/api/v1/adhkar/morning?locale=ar"), params("morning"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ar.title).toBe("أذكار الصباح");
  });

  it("returns azkar for en locale", async () => {
    vi.mocked(getAzkarBySlug).mockResolvedValueOnce(azkar);
    const res = await GET(req("/api/v1/adhkar/morning?locale=en"), params("morning"));
    expect(res.status).toBe(200);
  });

  it("404s on draft azkar", async () => {
    vi.mocked(getAzkarBySlug).mockResolvedValueOnce({ ...azkar, status: "draft" });
    const res = await GET(req("/api/v1/adhkar/morning"), params("morning"));
    expect(res.status).toBe(404);
  });

  it("404s when service throws NotFound", async () => {
    const { AppError } = await import("@repo/api/errors");
    vi.mocked(getAzkarBySlug).mockRejectedValueOnce(AppError.NotFound("Azkar"));
    const res = await GET(req("/api/v1/adhkar/missing"), params("missing"));
    expect(res.status).toBe(404);
  });
});
