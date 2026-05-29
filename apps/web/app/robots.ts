import type { MetadataRoute } from "next";

// Build-inlined public origin (same exception as the pages — not via the env
// barrel, which requires secrets at build time).
const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /api is JSON-only; /*/search results carry their own noindex but we
      // keep crawlers off the query-string variants too.
      disallow: ["/api/", "/ar/search", "/en/search"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
