import { AppError } from "@repo/api/errors";
import { getTafsir } from "@repo/api/services/quran";
import { isLocale } from "@repo/shared-core/schemas/locale";

import { corsPreflight } from "@/lib/cors";
import { jsonOk, jsonError } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Defense-in-depth: tafsir HTML is trusted (seeded from quran.com) but strip
// any <script> before sending it to the client for dangerouslySetInnerHTML.
function stripScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

export function OPTIONS(): Response {
  return corsPreflight();
}

export async function GET(request: Request): Promise<Response> {
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

    return jsonOk({ edition: result.edition, html: stripScripts(result.html) });
  } catch (error) {
    return jsonError(error);
  }
}
