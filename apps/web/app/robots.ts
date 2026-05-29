import type { MetadataRoute } from "next";

import { LOCALES } from "@repo/api/schemas/locale";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /api is JSON-only; search results carry their own noindex but we also
      // disallow the query-string variants to keep crawlers off indexing them.
      disallow: ["/api/", ...LOCALES.map((l) => `/${l}/search`)],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
