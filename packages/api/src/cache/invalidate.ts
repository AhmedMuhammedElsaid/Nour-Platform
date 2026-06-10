import { revalidateTag } from "next/cache";

import { env } from "@repo/config/env";

/*
 * One call site for cache invalidation after a public-affecting mutation.
 *
 * revalidateTag only invalidates the deployment it runs in. Mutations run in
 * the ADMIN app, but the cached readers live in the WEB app — so we also POST
 * the tags to web's /api/revalidate webhook. The webhook is best-effort: every
 * web cache entry carries `revalidate: 300`, so a missed ping self-heals in
 * ≤5 minutes.
 */
export async function invalidate(tags: string[]): Promise<void> {
  for (const tag of tags) {
    revalidateTag(tag, "default");
  }

  const url = env.WEB_REVALIDATE_URL;
  const secret = env.REVALIDATE_SECRET;
  if (!url || !secret) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ tags }),
    });
  } catch {
    // Best-effort by design — the TTL fallback covers a missed webhook.
  }
}
