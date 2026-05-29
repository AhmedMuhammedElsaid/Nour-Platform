import { headers } from "next/headers";

import type { JsonLdObject } from "@/lib/seo";

/*
 * Renders schema.org JSON-LD as an inline <script>. The app's CSP is
 * nonce-based with `strict-dynamic` and NO `'unsafe-inline'` in script-src
 * (apps/web/lib/csp.ts), so an inline script is dropped by the browser unless
 * it carries the per-request nonce. The proxy forwards that nonce on the
 * `x-nonce` request header (apps/web/proxy.ts) — read it here and apply it.
 *
 * Server component (reads headers()); the consuming routes are already
 * `force-dynamic`, so there is no static-render penalty.
 */
export async function JsonLd({
  data,
}: {
  data: JsonLdObject | JsonLdObject[];
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // Escape `<` so a `</script>` sequence inside any string field (e.g. an
  // admin-authored title/description) can't break out of the script element.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
