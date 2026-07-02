import { useEffect, useState } from "react";

// In-page hash router — the new-tab is a small SPA, so views are encoded in the
// URL hash (`#/playlist/<slug>`, `#/quran/<surah>`, …) instead of Next.js routes.
// Deep-linkable and back/forward-aware via `hashchange`.

export type Route =
  | { view: "home" }
  | { view: "playlist"; slug: string; trackId?: string }
  | { view: "search"; q: string }
  | { view: "adhkar" }
  | { view: "adhkar-read"; slug: string }
  | { view: "quran" }
  | { view: "quran-read"; surah: string; autoplay?: boolean }
  | { view: "bookmarks" }
  | { view: "prayer-times" };

export const HOME: Route = { view: "home" };

// Serialise a route to a hash (without the leading `#`). Slugs may be non-ASCII
// (Arabic), so they're percent-encoded.
export function routeToHash(route: Route): string {
  switch (route.view) {
    case "home":
      return "/";
    case "playlist":
      return `/playlist/${encodeURIComponent(route.slug)}${route.trackId ? `?t=${encodeURIComponent(route.trackId)}` : ""}`;
    case "search":
      return `/search?q=${encodeURIComponent(route.q)}`;
    case "adhkar":
      return "/adhkar";
    case "adhkar-read":
      return `/adhkar/${encodeURIComponent(route.slug)}`;
    case "quran":
      return "/quran";
    case "quran-read":
      return `/quran/${encodeURIComponent(route.surah)}${route.autoplay ? "?autoplay=1" : ""}`;
    case "bookmarks":
      return "/bookmarks";
    case "prayer-times":
      return "/prayer-times";
  }
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const [path = "/", query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  const [head, arg] = segments;

  switch (head) {
    case undefined:
      return HOME;
    case "playlist":
      if (!arg) return HOME;
      return { view: "playlist", slug: arg, trackId: params.get("t") ?? undefined };
    case "search":
      return { view: "search", q: params.get("q") ?? "" };
    case "adhkar":
      return arg ? { view: "adhkar-read", slug: arg } : { view: "adhkar" };
    case "quran":
      return arg
        ? {
            view: "quran-read",
            surah: arg,
            // Keep autoplay optional (omit when absent) so it round-trips with
            // routeToHash, which only emits ?autoplay=1 when truthy.
            ...(params.get("autoplay") === "1" ? { autoplay: true } : {}),
          }
        : { view: "quran" };
    case "bookmarks":
      return { view: "bookmarks" };
    case "prayer-times":
      return { view: "prayer-times" };
    default:
      return HOME;
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route);
}

// Reactive current route; re-renders on hashchange (back/forward + navigate()).
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
