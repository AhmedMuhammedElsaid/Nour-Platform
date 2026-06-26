import { searchContent } from "@repo/api/services/search";
import type { Locale } from "@repo/api/schemas/locale";

import { corsPreflight } from "@/lib/cors";
import { jsonOk, jsonError } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return corsPreflight();
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const locale: Locale =
      searchParams.get("locale") === "en" ? "en" : "ar";
    const results = await searchContent(locale, q);
    return jsonOk(results);
  } catch (error) {
    return jsonError(error);
  }
}
