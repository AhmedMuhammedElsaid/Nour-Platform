import { AppError } from "@repo/api/errors";
import { getSurahReader } from "@repo/api/services/quran";
import { isLocale } from "@repo/shared-core/schemas/locale";

import { corsPreflight } from "@/lib/cors";
import { apiRoute, jsonOk, jsonError } from "../../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return corsPreflight();
}

type NumberContext = { params: Promise<{ n: string }> };

export const GET = apiRoute("static", async (request: Request, { params }: NumberContext): Promise<Response> => {
  try {
    const { n } = await params;
    const surahNumber = Number(n);
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      throw AppError.Validation([], "Invalid surah number.");
    }

    const url = new URL(request.url);
    const localeRaw = url.searchParams.get("locale") ?? "ar";
    const locale = isLocale(localeRaw) ? localeRaw : "ar";
    const translationSlug = url.searchParams.get("translation") ?? undefined;
    const reciterSlug = url.searchParams.get("reciter") ?? undefined;

    const reader = await getSurahReader(surahNumber, { locale, translationSlug, reciterSlug });
    return jsonOk(reader);
  } catch (error) {
    return jsonError(error);
  }
});
