import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/api/services/radio", () => ({ getStationBySlug: vi.fn() }));

const { getStationBySlug } = await import("@repo/api/services/radio");
const { GET, OPTIONS } = await import("./route");

function req(): Request {
  return new Request("http://localhost/api/v1/radio/quran-cairo/now-playing");
}
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

const baseStation = {
  id: "1",
  slug: "quran-cairo",
  ar: { name: "إذاعة" },
  en: { name: "Radio" },
  country: "EG",
  streamUrl: "https://stream.radiojar.com/8s5u5tpdtwzuv",
  streamType: "mp3" as const,
  language: "ar",
  category: "quran" as const,
  isLive: true,
  isFeatured: true,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Builds an ICY body: `metaint` audio bytes, a length byte (blocks of 16), then
// the null-padded metadata block carrying StreamTitle.
function icyStream(metaint: number, title: string): ReadableStream<Uint8Array> {
  const meta = new TextEncoder().encode(`StreamTitle='${title}';`);
  const blocks = Math.ceil(meta.length / 16);
  const buf = new Uint8Array(metaint + 1 + blocks * 16);
  buf[metaint] = blocks;
  buf.set(meta, metaint + 1);
  return new ReadableStream({
    start(c) {
      c.enqueue(buf);
      c.close();
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getStationBySlug).mockReset();
});

describe("GET /api/v1/radio/[slug]/now-playing", () => {
  it("parses StreamTitle from interleaved ICY metadata", async () => {
    vi.mocked(getStationBySlug).mockResolvedValueOnce(baseStation);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(icyStream(16, "Surah Al-Mulk"), { headers: { "icy-metaint": "16" } }),
    );
    const res = await GET(req(), ctx("quran-cairo"));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Surah Al-Mulk");
  });

  it("returns { title: null } when the stream emits no icy-metaint header", async () => {
    vi.mocked(getStationBySlug).mockResolvedValueOnce(baseStation);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    const res = await GET(req(), ctx("quran-cairo"));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBeNull();
  });

  it("prefers a station nowPlayingUrl JSON endpoint", async () => {
    vi.mocked(getStationBySlug).mockResolvedValueOnce({
      ...baseStation,
      nowPlayingUrl: "https://station.example/np.json",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ now_playing: { song: { title: "Live Khutbah" } } }),
    );
    const res = await GET(req(), ctx("quran-cairo"));
    expect((await res.json()).title).toBe("Live Khutbah");
  });

  it("returns { title: null } (never throws) when the upstream fetch fails", async () => {
    vi.mocked(getStationBySlug).mockResolvedValueOnce(baseStation);
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));
    const res = await GET(req(), ctx("quran-cairo"));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBeNull();
  });

  it("maps an unknown/disabled station to the service's error status", async () => {
    const { AppError } = await import("@repo/api/errors");
    vi.mocked(getStationBySlug).mockRejectedValueOnce(AppError.NotFound("RadioStation"));
    const res = await GET(req(), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("sets CORS headers on the preflight", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
