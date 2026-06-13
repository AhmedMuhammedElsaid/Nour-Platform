import { getJson } from "@/lib/api";

// Regression guard: getJson must keep the "/api/v1" base when joining a
// leading-slash path. `new URL("/playlists", ".../api/v1")` silently drops
// "/api/v1" (root-relative), which sent every request to "https://host/playlists"
// and surfaced as "something went wrong" on every screen.
describe("getJson URL construction", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function mockFetch() {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [] } as unknown as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("keeps the /api/v1 prefix for a leading-slash path", async () => {
    const fetchMock = mockFetch();
    await getJson("/playlists", { locale: "ar" });
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/api/v1/playlists");
    expect(calledUrl).toContain("locale=ar");
  });

  it("preserves nested paths", async () => {
    const fetchMock = mockFetch();
    await getJson("/quran/surah/2");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/quran/surah/2");
  });
});
