/*
 * Nour service worker — hand-rolled, no build step (plain JS in /public).
 * See docs/adr/0003-pwa-service-worker.md for why we don't use next-pwa.
 *
 * Strategies:
 *   - navigations (HTML): network-first → runtime cache → offline.html.
 *       The full Response (incl. its own per-request CSP header) is cached, so
 *       an offline-served page is self-consistent with its own nonce.
 *   - /_next/static/*: cache-first (immutable, content-hashed).
 *   - same-origin assets (icons/manifest/images): stale-while-revalidate.
 *   - R2 audio: "cache-played" with HTTP Range support (see handleAudio).
 *   - /api/*: never handled (network-only, falls through to the browser).
 */

const VERSION = "v1";
const SHELL_CACHE = `nour-shell-${VERSION}`;
const PAGES_CACHE = `nour-pages-${VERSION}`;
const STATIC_CACHE = `nour-static-${VERSION}`;
const AUDIO_CACHE = `nour-audio-${VERSION}`;
const KEEP = new Set([SHELL_CACHE, PAGES_CACHE, STATIC_CACHE, AUDIO_CACHE]);

const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon.svg", "/manifest.webmanifest"];

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav|flac)(\?|$)/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !KEEP.has(key)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isAudioRequest(request, url) {
  return request.destination === "audio" || AUDIO_EXT.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API/auth traffic.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  // R2 audio (cross-origin) — cache-played with range support.
  if (isAudioRequest(request, url)) {
    event.respondWith(handleAudio(request, url));
    return;
  }

  // Beyond here we only handle same-origin GETs.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    // Cache the whole response (headers included → nonce stays consistent).
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return (
      offline ||
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );
  }
}

/*
 * Audio caching with Range support.
 *
 * Audio elements issue Range requests; to serve any slice offline we need the
 * FULL body cached. We fetch the complete object once (mode:"cors" so the body
 * is readable — REQUIRES the R2 bucket to send CORS headers for the web origin;
 * otherwise the cors fetch fails and we transparently fall back to streaming).
 * Subsequent/seek Range requests are answered from the cached body as 206.
 */
async function handleAudio(request, url) {
  const cache = await caches.open(AUDIO_CACHE);
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const range = request.headers.get("range");

  let full = await cache.match(cacheKey);
  if (!full) {
    try {
      const response = await fetch(url.toString(), { mode: "cors" });
      if (response && response.status === 200) {
        await cache.put(cacheKey, response.clone());
        full = response;
      } else {
        // Couldn't read a full body (opaque/error) — stream the original.
        return fetch(request);
      }
    } catch {
      const cached = await cache.match(cacheKey);
      if (cached) full = cached;
      else return fetch(request);
    }
  }

  if (!range) return full.clone();

  const buffer = await full.clone().arrayBuffer();
  const size = buffer.byteLength;
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  let start = match && match[1] ? parseInt(match[1], 10) : 0;
  let end = match && match[2] ? parseInt(match[2], 10) : size - 1;
  if (Number.isNaN(start)) start = 0;
  if (Number.isNaN(end) || end >= size) end = size - 1;

  const slice = buffer.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": full.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(slice.byteLength),
      "Accept-Ranges": "bytes",
    },
  });
}
