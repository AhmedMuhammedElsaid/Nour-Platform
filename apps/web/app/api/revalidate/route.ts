import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Cross-deployment cache invalidation endpoint. The admin deployment calls this
 * (via invalidate() in @repo/api) so the web deployment drops the data-cache
 * entries for mutated tags — revalidateTag only invalidates the deployment it
 * runs in, and the cached readers live here, not in admin.
 *
 * Reads REVALIDATE_SECRET from process.env directly (not the env barrel): this
 * route is evaluated during `next build`'s collection step, where importing
 * @repo/config/env would throw on the absent MONGODB_URI/AUTH_SECRET.
 */
const bodySchema = z.object({ tags: z.array(z.string().min(1)).max(20) });

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("x-revalidate-secret");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  for (const tag of parsed.data.tags) {
    revalidateTag(tag, "default");
  }
  return NextResponse.json({ revalidated: parsed.data.tags });
}
