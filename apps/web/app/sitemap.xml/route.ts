import { getPublishedAzkar } from "@repo/api/services/azkar";
import { getPublishedPlaylists } from "@repo/api/services/playlist";

import {
  buildSitemapXml,
  type SitemapAzkarInput,
  type SitemapPlaylistInput,
} from "@/lib/sitemap";

export const runtime = "nodejs";

/*
 * Generated at request time: the deploy build runs without Atlas connectivity
 * and the content is dynamic. This used to be the `app/sitemap.ts` metadata
 * file, but `force-dynamic` is not honoured there — Next dropped the route from
 * the build and /sitemap.xml 404'd in production. Route handlers support it.
 */
export const dynamic = "force-dynamic";

/**
 * Fetch guard: an Atlas outage must degrade the sitemap to its static entries,
 * never 500. Each source is guarded independently so one failing collection
 * doesn't drop the other's URLs.
 */
async function safeList<T>(fetcher: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fetcher();
  } catch {
    return [];
  }
}

export async function GET(): Promise<Response> {
  const [playlists, adhkar] = await Promise.all([
    safeList<SitemapPlaylistInput>(getPublishedPlaylists),
    safeList<SitemapAzkarInput>(getPublishedAzkar),
  ]);

  return new Response(buildSitemapXml({ playlists, adhkar }), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
