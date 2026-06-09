import { AppError } from "@repo/api/errors";
import { getPlaylistBySlug } from "@repo/api/services/playlist";
import { getTracksWithUrls } from "@repo/api/services/track";
import { isLocale } from "@repo/shared-core/schemas/locale";

import { corsPreflight } from "@/lib/cors";
import { jsonOk, jsonError } from "../../_lib/respond";
import { withIsoDates } from "../../_lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return corsPreflight();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const localeRaw = url.searchParams.get("locale") ?? "ar";
    const locale = isLocale(localeRaw) ? localeRaw : "ar";

    const playlist = await getPlaylistBySlug(locale, slug);
    if (!playlist || playlist.status !== "published") {
      throw AppError.NotFound("Playlist");
    }
    const tracks = await getTracksWithUrls(playlist.id);

    return jsonOk({
      playlist: withIsoDates(playlist),
      tracks: tracks.map(withIsoDates),
    });
  } catch (error) {
    return jsonError(error);
  }
}
