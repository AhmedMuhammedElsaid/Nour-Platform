/*
 * Nour service worker — hand-rolled, no build step (plain JS in /public).
 * See docs/adr/0003-pwa-service-worker.md for why we don't use next-pwa.
 *
 * Strategies:
 *   - navigations (HTML): network-first → runtime cache → offline.html.
 *       The full Response (incl. its own per-request CSP header) is cached, so
 *       an offline-served page is self-consistent with its own nonce.
 *   - RSC payloads (client-side nav/prefetch, ?_rsc= / RSC header): network-first
 *       → cache fallback. MUST NOT be stale-while-revalidate'd: doing so serves a
 *       cached copy of dynamic page content first, so admin edits never reach
 *       returning/installed users and old UI (e.g. a replaced reader) keeps
 *       showing on in-app navigation even after deploy.
 *   - /_next/static/*: cache-first (immutable, content-hashed).
 *   - static same-origin assets (icons/manifest/images/fonts): stale-while-revalidate.
 *   - R2 audio: "cache-played" with HTTP Range support (see handleAudio).
 *   - /api/*: never handled (network-only, falls through to the browser).
 */

// Bump on any change to caching strategy so the activate handler purges the
// previous generation of caches (including any stale RSC payloads that the old
// catch-all stale-while-revalidate wrongly stored in STATIC_CACHE).
// v6 (2026-06-09): one-time cache-bust so every browser + installed-PWA client
// purges old caches and reloads once into the latest build on its next open.
// v7 (2026-06-10): adhan mp3s (~13.5 MB total) removed from PRECACHE — every
// visitor was downloading them on SW install even with azan disabled. They are
// now cached on demand via the "nour:cache-adhan" message (see below).
const VERSION = "v7";
const SHELL_CACHE = `nour-shell-${VERSION}`;
const PAGES_CACHE = `nour-pages-${VERSION}`;
const STATIC_CACHE = `nour-static-${VERSION}`;
const AUDIO_CACHE = `nour-audio-${VERSION}`;
const KEEP = new Set([SHELL_CACHE, PAGES_CACHE, STATIC_CACHE, AUDIO_CACHE]);

const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon.svg", "/manifest.webmanifest"];

// Adhan recordings are large and only useful to users who enable azan, so they
// are NOT precached. The adhan controller posts "nour:cache-adhan" when azan
// is enabled (and on every visit while it stays enabled) and we warm
// AUDIO_CACHE on demand; first foreground playback also lands in AUDIO_CACHE
// via handleAudio as a fallback.
const ADHAN_AUDIO = ["/audio/adhan.mp3", "/audio/adhan-fajr.mp3"];

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

// Next.js App Router fetches RSC payloads for client-side navigation and
// prefetch. They are dynamic page content, NOT static assets — caching them
// stale-first makes content edits invisible and pins old UI. Detect via the
// RSC request header or the ?_rsc= cache-busting param.
function isRscRequest(request, url) {
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
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

  // RSC payloads carry live page content — keep them fresh (offline falls back
  // to the last good copy). Must run before the static SWR catch-all, which
  // would otherwise serve them stale.
  if (isRscRequest(request, url)) {
    event.respondWith(networkFirstData(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Only genuinely static assets reach the catch-all. Restrict to safe
  // destinations so no dynamic same-origin GET is ever served stale.
  if (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style" ||
    request.destination === "script" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Everything else (dynamic same-origin data) — network with cache fallback.
  event.respondWith(networkFirstData(request));
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

// Network-first for dynamic non-navigation GETs (RSC payloads, data fetches).
// Falls back to the last cached copy only when the network is unavailable, so
// online users always see fresh content while offline still degrades gracefully.
async function networkFirstData(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Network error and no cached copy available");
  }
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

// On-demand adhan caching (replaces the old precache). Keys are absolute-URL
// Requests so they match the ones handleAudio reads/writes.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "nour:cache-adhan") return;
  event.waitUntil(
    caches.open(AUDIO_CACHE).then(async (cache) => {
      for (const path of ADHAN_AUDIO) {
        const url = new URL(path, self.location.origin).toString();
        const key = new Request(url, { method: "GET" });
        if (await cache.match(key)) continue;
        try {
          const response = await fetch(url);
          if (response && response.status === 200) {
            await cache.put(key, response);
          }
        } catch {
          // Offline / fetch failed — the next enable-visit or the first
          // foreground playback (handleAudio) will cache it instead.
        }
      }
    }),
  );
});

/*
 * Adhan notifications (Layer B). When the user clicks a triggered adhan
 * notification, focus an existing Nour tab (or open one) and tell it to play
 * the adhan in-page. The audio is cached on demand (see "nour:cache-adhan")
 * so it works offline once azan has been enabled.
 */
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const tag = notification.tag || "";

  // Azkar al-Sabah/al-Masaa reminder → open the reader at the stored URL.
  if (tag.startsWith("nour-azkar-")) {
    notification.close();
    const raw = (notification.data && notification.data.url) || "/";
    // Resolve to an absolute, same-origin URL so navigate()/openWindow() and
    // the focused-tab match below all compare against the same string.
    const url = new URL(raw, self.location.origin).href;
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        // Already on the target page? Just focus it.
        const onTarget = clients.find((c) => c.url === url);
        if (onTarget) return onTarget.focus();
        // Otherwise focus an existing tab and navigate it. navigate() can throw
        // for an uncontrolled client, so fall back to opening a new window.
        const open = clients.find((c) => "focus" in c);
        if (open) {
          try {
            const navigated = await open.navigate(url);
            return (navigated || open).focus();
          } catch {
            /* fall through to openWindow */
          }
        }
        return self.clients.openWindow(url);
      })(),
    );
    return;
  }

  if (!tag.startsWith("nour-adhan-")) return;
  notification.close();
  const adhanKey = notification.data && notification.data.adhanKey;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const target = clients.find((c) => "focus" in c);
        if (target) {
          target.postMessage({ type: "adhan:play", adhanKey });
          return target.focus();
        }
        // No open tab — open the prayer-times page; the controller mounted in
        // the layout will not auto-play without a gesture, but the page opens.
        return self.clients.openWindow("/");
      }),
  );
});
