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
  streamUrl: "https://backup.qurango.net/radio/mahmoud_khalil_alhussary",
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

  it("decodes a percent/form-encoded StreamTitle (e.g. mixlr) to readable text", async () => {
    vi.mocked(getStationBySlug).mockResolvedValueOnce(baseStation);
    // "سورة القمر إسلام صبحي" emitted form-urlencoded, as mixlr does.
    const encoded =
      "%D8%B3%D9%88%D8%B1%D8%A9+%D8%A7%D9%84%D9%82%D9%85%D8%B1+%D8%A5%D8%B3%D9%84%D8%A7%D9%85+%D8%B5%D8%A8%D8%AD%D9%8A";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(icyStream(16, encoded), { headers: { "icy-metaint": "16" } }),
    );
    const res = await GET(req(), ctx("quran-cairo"));
    expect((await res.json()).title).toBe("سورة القمر إسلام صبحي");
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
      nowPlayingUrl: "https://backup.qurango.net/status-json.xsl",
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

  // Stored-SSRF guard. These rows are unreachable through Zod, but a direct
  // Atlas insert (or a row written before the schema was tightened) reaches the
  // route unvalidated — so the route re-checks immediately before fetch.
  describe("stored-SSRF host allow-list", () => {
    it("never opens a socket to an off-list streamUrl and reports no metadata", async () => {
      vi.mocked(getStationBySlug).mockResolvedValueOnce({
        ...baseStation,
        streamUrl: "http://169.254.169.254/latest/meta-data/",
      });
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const res = await GET(req(), ctx("quran-cairo"));
      expect(fetchSpy).not.toHaveBeenCalled();
      // Same shape as "this stream emits no title" — no 500, nothing leaked.
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ title: null });
    });

    it("never opens a socket to an off-list nowPlayingUrl", async () => {
      vi.mocked(getStationBySlug).mockResolvedValueOnce({
        ...baseStation,
        // look-alike: ends with "qurango.net" but is not a subdomain of it
        nowPlayingUrl: "https://evil-qurango.net/np.json",
      });
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
      const res = await GET(req(), ctx("quran-cairo"));
      // Exactly one call — the ICY fallback on the (allow-listed) streamUrl.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe(baseStation.streamUrl);
      expect(await res.json()).toEqual({ title: null });
    });

    it("does not echo the rejected URL back to the caller", async () => {
      vi.mocked(getStationBySlug).mockResolvedValueOnce({
        ...baseStation,
        streamUrl: "http://10.0.0.5/admin",
        nowPlayingUrl: "http://169.254.169.254/latest/meta-data/",
      });
      vi.spyOn(globalThis, "fetch");
      const res = await GET(req(), ctx("quran-cairo"));
      const body = await res.text();
      expect(body).not.toContain("169.254");
      expect(body).not.toContain("10.0.0.5");
      expect(body).toBe(JSON.stringify({ title: null }));
    });

    // Redirect policy: `redirect: "manual"` + re-validate each hop. The default
    // "follow" would let an allow-listed host 302 straight into the hole.
    it("follows an allow-listed redirect (zeno.fm → surfernetwork.com)", async () => {
      vi.mocked(getStationBySlug).mockResolvedValueOnce({
        ...baseStation,
        streamUrl: "https://stream.zeno.fm/ru2hqnplhk7uv",
      });
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { location: "https://n01.surfernetwork.com/edge" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(icyStream(16, "Surah Al-Mulk"), { headers: { "icy-metaint": "16" } }),
        );
      const res = await GET(req(), ctx("quran-cairo"));
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1]?.[0]).toBe("https://n01.surfernetwork.com/edge");
      expect((await res.json()).title).toBe("Surah Al-Mulk");
    });

    it("stops at a redirect that leaves the allow-list", async () => {
      vi.mocked(getStationBySlug).mockResolvedValueOnce(baseStation);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        }),
      );
      const res = await GET(req(), ctx("quran-cairo"));
      // The redirect target is never requested.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(await res.json()).toEqual({ title: null });
    });

    it("stops at a RELATIVE redirect that escapes to an off-list host", async () => {
      vi.mocked(getStationBySlug).mockResolvedValueOnce(baseStation);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        // protocol-relative Location — resolves to a different host entirely
        new Response(null, { status: 302, headers: { location: "//attacker.tld/x" } }),
      );
      const res = await GET(req(), ctx("quran-cairo"));
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(await res.json()).toEqual({ title: null });
    });

    it("requests every hop with redirect: manual", async () => {
      vi.mocked(getStationBySlug).mockResolvedValueOnce(baseStation);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
      await GET(req(), ctx("quran-cairo"));
      const init = fetchSpy.mock.calls[0]?.[1];
      expect(init?.redirect).toBe("manual");
    });

    it("gives up rather than following a redirect chain forever", async () => {
      vi.mocked(getStationBySlug).mockResolvedValueOnce(baseStation);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "https://backup.qurango.net/loop" },
        }),
      );
      const res = await GET(req(), ctx("quran-cairo"));
      // MAX_REDIRECTS = 2 ⇒ at most 3 requests, then null.
      expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(3);
      expect(await res.json()).toEqual({ title: null });
    });
  });

  it("sets CORS headers on the preflight", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
