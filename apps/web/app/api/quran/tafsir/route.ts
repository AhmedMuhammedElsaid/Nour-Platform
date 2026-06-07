import { NextResponse } from "next/server";
import { getTafsir } from "@repo/api/services/quran";
import { isLocale } from "@repo/api/schemas/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Defense-in-depth: tafsir HTML is trusted (seeded from quran.com) but strip
// any <script> before sending it to the client for dangerouslySetInnerHTML.
function stripScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const ayah = Number(url.searchParams.get("ayah"));
  const localeRaw = url.searchParams.get("locale") ?? "ar";
  const editionSlug = url.searchParams.get("edition") ?? undefined;

  if (!Number.isInteger(ayah) || ayah < 1 || ayah > 6236) {
    return NextResponse.json({ error: "invalid ayah" }, { status: 400 });
  }
  const locale = isLocale(localeRaw) ? localeRaw : "ar";

  const result = await getTafsir(ayah, { locale, ...(editionSlug ? { editionSlug } : {}) });
  if (!result) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(
    { edition: result.edition, html: stripScripts(result.html) },
    { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
