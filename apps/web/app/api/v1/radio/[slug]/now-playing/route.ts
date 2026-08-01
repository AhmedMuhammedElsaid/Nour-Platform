import { getStationBySlug } from "@repo/api/services/radio";
import type { RadioStation } from "@repo/api/schemas/radio";
import { isAllowedRadioUrl } from "@repo/config/radio-hosts";
import { NextResponse } from "next/server";

import { corsPreflight, withCors } from "@/lib/cors";
import { apiRoute, jsonError } from "../../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort "now playing" for a live radio stream. Browsers and RNTP do NOT
// expose ICY inline metadata to JS, so this must run server-side. Two sources,
// in order of preference:
//   1. station.nowPlayingUrl — a station-provided JSON metadata endpoint.
//   2. the stream itself, opened with `Icy-MetaData: 1` — parse `StreamTitle`.
// A missing title is NORMAL (many streams, incl. the Cairo one, never emit one),
// never an error: the metadata resolver always returns a title or null, and only
// an unknown/disabled slug produces a non-200 (via getStationBySlug → NotFound).
//
// Clients poll this every ~20–30s while a station plays and fall back to a "Live
// broadcast" label when title is null.

const FETCH_TIMEOUT_MS = 5000;
// ICY metadata length byte is a count of 16-byte blocks; max 255 ⇒ 4080 bytes.
const MAX_META_BYTES = 255 * 16;
// stream.zeno.fm 302s to *.surfernetwork.com, so redirects must be followed —
// but manually, re-validating every hop. Two is enough for every seeded station.
const MAX_REDIRECTS = 2;

export function OPTIONS(): Response {
  return corsPreflight();
}

type SlugContext = { params: Promise<{ slug: string }> };

// Rate-limited as "now-playing": this is the only route that opens an OUTBOUND
// socket per request, so unlimited traffic here amplifies onto third-party
// stream hosts as well as onto us.
export const GET = apiRoute("now-playing", async (_request: Request, { params }: SlugContext): Promise<Response> => {
  try {
    const { slug } = await params;
    // Throws NotFound (→404) for an unknown or disabled station.
    const station = await getStationBySlug(slug);
    const title = await resolveNowPlaying(station);
    // Short cache: "now playing" changes per-track. SWR keeps it cheap under the
    // clients' ~20–30s polling without hammering the origin stream.
    return withCors(
      NextResponse.json(
        { title },
        { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" } },
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
});

// Never throws — any failure resolves to null so the client shows "Live broadcast".
//
// SSRF re-check (defence in depth). Both URLs come straight off a Mongo doc and
// are fetched by the server, which then reflects part of the response back to an
// unauthenticated caller. The Zod schema already host-restricts them, but a row
// inserted directly into Atlas (this repo has a documented history of exactly
// that) or written before the schema gained the refinement never saw Zod. So
// re-assert the allow-list here, at the last point before the socket opens.
//
// A rejected URL is treated as "no metadata source": the response is the same
// `{ title: null }` the client already handles for the many streams that emit no
// title at all. No 500, no error body, and the rejected URL is never echoed —
// an unauthenticated caller cannot use this endpoint to probe what is stored.
async function resolveNowPlaying(station: RadioStation): Promise<string | null> {
  let raw: string | null = null;
  if (station.nowPlayingUrl && isAllowedRadioUrl(station.nowPlayingUrl)) {
    raw = await fetchNowPlayingJson(station.nowPlayingUrl);
  }
  if (raw === null && isAllowedRadioUrl(station.streamUrl)) {
    raw = await fetchIcyStreamTitle(station.streamUrl);
  }
  return raw ? decodeStreamTitle(raw) : null;
}

// Some providers (e.g. mixlr) emit the title percent/form-encoded — the ICY
// StreamTitle arrives as `%D8%B3%D9%88...+...` and would otherwise render as raw
// "%D8%…" bytes in the UI. Decode defensively: only touch strings that actually
// carry a percent-escape (so ordinary titles pass through untouched), treat `+`
// as space per form-urlencoding, and fall back to the original if decoding throws.
function decodeStreamTitle(raw: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(raw)) return raw;
  try {
    const decoded = decodeURIComponent(raw.replace(/\+/g, " ")).trim();
    return decoded.length > 0 ? decoded : raw;
  } catch {
    return raw;
  }
}

// Reads a station-provided JSON metadata endpoint and pulls out a title-ish
// string. Shapes vary wildly between providers, so probe the common keys.
async function fetchNowPlayingJson(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
    if (!res || !res.ok) return null;
    const data: unknown = await res.json();
    return extractTitle(data);
  } catch {
    return null;
  }
}

function extractTitle(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;
  // Common flat keys first, then a couple of nested shapes (Icecast status-json,
  // Radio.co / Live365-style now_playing).
  const flat = obj.title ?? obj.StreamTitle ?? obj.streamTitle ?? obj.song ?? obj.nowplaying;
  if (typeof flat === "string" && flat.trim()) return flat.trim();
  const nowPlaying = obj.now_playing;
  if (typeof nowPlaying === "object" && nowPlaying !== null) {
    const np = nowPlaying as Record<string, unknown>;
    if (typeof np.title === "string" && np.title.trim()) return np.title.trim();
    // `song` may be a plain string or a nested { title } object.
    if (typeof np.song === "string" && np.song.trim()) return np.song.trim();
    if (typeof np.song === "object" && np.song !== null) {
      const songTitle = (np.song as Record<string, unknown>).title;
      if (typeof songTitle === "string" && songTitle.trim()) return songTitle.trim();
    }
  }
  return null;
}

// Opens the audio stream requesting ICY metadata, reads just far enough to parse
// the first `StreamTitle`, then tears the connection down. Returns null if the
// server doesn't interleave metadata (no `icy-metaint`) or emits an empty title.
async function fetchIcyStreamTitle(streamUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchAllowlisted(streamUrl, {
      headers: { "Icy-MetaData": "1", "User-Agent": "NourRadio/1.0 (+nour-platform)", Accept: "*/*" },
      signal: controller.signal,
    });
    if (!res) return null;
    const metaint = Number(res.headers.get("icy-metaint"));
    if (!res.body || !Number.isFinite(metaint) || metaint <= 0) return null;
    return await readIcyTitle(res.body, metaint);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    // Abort regardless so we never leave the stream socket draining.
    controller.abort();
  }
}

async function readIcyTitle(
  body: ReadableStream<Uint8Array>,
  metaint: number,
): Promise<string | null> {
  const reader = body.getReader();
  let buffer = new Uint8Array(0);
  const maxNeeded = metaint + 1 + MAX_META_BYTES;
  try {
    while (buffer.length < maxNeeded) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        const merged = new Uint8Array(buffer.length + value.length);
        merged.set(buffer);
        merged.set(value, buffer.length);
        buffer = merged;
      }
      // Once the length byte has arrived we know the exact metadata size and can
      // stop as soon as the whole block is buffered (or immediately if empty).
      if (buffer.length > metaint) {
        const lenByte = buffer[metaint];
        if (lenByte === undefined) continue;
        const metaLen = lenByte * 16;
        if (metaLen === 0) return null;
        if (buffer.length >= metaint + 1 + metaLen) break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const lenByte = buffer[metaint];
  if (lenByte === undefined) return null;
  const metaLen = lenByte * 16;
  if (metaLen === 0 || buffer.length < metaint + 1 + metaLen) return null;

  const metaStr = new TextDecoder("utf-8").decode(buffer.slice(metaint + 1, metaint + 1 + metaLen));
  const match = /StreamTitle='([^']*)'/.exec(metaStr);
  const title = match?.[1]?.trim();
  return title && title.length > 0 ? title : null;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchAllowlisted(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/*
 * The SSRF-safe fetch. Redirects are followed MANUALLY, re-validating every hop
 * against the radio allow-list.
 *
 * `redirect: "follow"` (the fetch default, and what this route used before)
 * re-opens the entire hole from the other end: an allow-listed host is free to
 * answer 302 → http://169.254.169.254/… and undici follows it without ever
 * consulting the allow-list again, so validating only the first URL proves
 * nothing. `redirect: "error"` is not an option either — the Cairo station's
 * stream.zeno.fm mount legitimately 302s to *.surfernetwork.com (which is why
 * that host is in the allow-list at all). Manual following is the only policy
 * that keeps the legitimate hop and closes the illegitimate one.
 *
 * Returns null — never throws — for a blocked hop, a redirect with no Location,
 * or more than MAX_REDIRECTS hops. Callers already map null to `{ title: null }`.
 */
async function fetchAllowlisted(url: string, init: RequestInit): Promise<Response | null> {
  let target = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isAllowedRadioUrl(target)) return null;
    const res = await fetch(target, { ...init, redirect: "manual", cache: "no-store" });
    if (res.status < 300 || res.status > 399) return res;
    const location = res.headers.get("location");
    // Never leave the 3xx body draining once we've decided to move on.
    if (res.body) await res.body.cancel().catch(() => {});
    if (!location) return null;
    try {
      // A relative Location is legal (RFC 9110 §10.2.2) — resolve against the
      // hop we actually requested, not the original URL.
      target = new URL(location, target).toString();
    } catch {
      return null;
    }
  }
  return null;
}
