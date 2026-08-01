import { AppError } from "@repo/api/errors";
import { getTafsir } from "@repo/api/services/quran";
import { isLocale } from "@repo/shared-core/schemas/locale";

import { corsPreflight } from "@/lib/cors";
import { apiRoute, jsonOk, jsonError } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// HTML sanitization happens at the service boundary (quran.service.ts
// getTafsir → sanitizeTafsirHtml, before the unstable_cache write) so every
// consumer of this payload is protected — including the mobile app, which
// hits this same /api/v1 endpoint with no CSP at all.

export function OPTIONS(): Response {
  return corsPreflight();
}

export const GET = apiRoute("tafsir", async (request: Request): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const ayah = Number(url.searchParams.get("ayah"));
    const localeRaw = url.searchParams.get("locale") ?? "ar";
    const editionSlug = url.searchParams.get("edition") ?? undefined;

    if (!Number.isInteger(ayah) || ayah < 1 || ayah > 6236) {
      throw AppError.Validation([], "Invalid ayah.");
    }
    const locale = isLocale(localeRaw) ? localeRaw : "ar";

    const result = await getTafsir(ayah, { locale, ...(editionSlug ? { editionSlug } : {}) });
    if (!result) {
      throw AppError.NotFound("Tafsir");
    }

    return jsonOk({ edition: result.edition, html: result.html });
  } catch (error) {
    return jsonError(error);
  }
});
