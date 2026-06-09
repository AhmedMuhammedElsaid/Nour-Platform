import { getPublishedPlaylists } from "@repo/api/services/playlist";
import { listCategories } from "@repo/api/services/category";

import { corsPreflight } from "@/lib/cors";
import { jsonOk, jsonError } from "../_lib/respond";
import { withIsoDates } from "../_lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return corsPreflight();
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const categorySlug = url.searchParams.get("category") ?? undefined;
    const sort = url.searchParams.get("sort") === "tracks" ? "tracks" : "az";

    let categoryId: string | undefined;
    if (categorySlug != null) {
      const categories = await listCategories();
      categoryId = categories.find(
        (c) => c.ar.slug === categorySlug || c.en.slug === categorySlug,
      )?.id;
      if (categoryId == null) {
        return jsonOk([]);
      }
    }

    const playlists = await getPublishedPlaylists(categoryId != null ? { categoryId } : undefined);
    const sorted =
      sort === "tracks"
        ? [...playlists].sort((a, b) => (b.trackCount ?? 0) - (a.trackCount ?? 0))
        : [...playlists].sort((a, b) => a.ar.title.localeCompare(b.ar.title));

    return jsonOk(sorted.map(withIsoDates));
  } catch (error) {
    return jsonError(error);
  }
}
