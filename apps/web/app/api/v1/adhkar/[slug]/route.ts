import { AppError } from "@repo/api/errors";
import { getAzkarBySlug } from "@repo/api/services/azkar";
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

    const azkar = await getAzkarBySlug(locale, slug);
    if (azkar.status !== "published") {
      throw AppError.NotFound("Azkar");
    }
    return jsonOk(withIsoDates(azkar));
  } catch (error) {
    return jsonError(error);
  }
}
