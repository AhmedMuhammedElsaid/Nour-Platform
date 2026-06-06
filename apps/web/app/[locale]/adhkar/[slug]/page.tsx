import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getAzkarBySlug } from "@repo/api/services/azkar";
import { getMediaUrlById } from "@repo/api/services/media";
import { AppError } from "@repo/api/errors";
import type { Locale } from "@repo/api/schemas/locale";
import { localeAlternates, defaultTwitter, SITE_NAME } from "@/lib/seo";
import { AdhkarReader } from "@/features/adhkar/components/adhkar-reader";
import type { SerializedAzkar, SerializedDhikrItem } from "@/features/adhkar/types";

// Next.js + next-intl do not percent-decode the dynamic [slug] param, so a
// non-ASCII (Arabic) slug arrives URL-encoded (e.g. "%D8%AF…") and never
// matches the stored Unicode slug. Decode at the request boundary before the
// service lookup. Wrapped in try/catch because a malformed percent sequence
// throws URIError; slugs never legitimately contain a bare "%", so falling
// back to the raw value just yields a clean notFound().
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce,
// which would mismatch a cached static HTML body; forcing dynamic rendering
// is also what the deploy build (no Atlas connection at build time) requires.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;

  let azkar;
  try {
    azkar = await getAzkarBySlug(locale, decodeSlug(slug));
  } catch {
    return { robots: { index: false } };
  }

  if (azkar.status !== "published") {
    return { robots: { index: false } };
  }

  const display = azkar[locale];
  const arSlug = azkar.ar.slug;
  const enSlug = azkar.en.slug;

  const pathByLocale: Partial<Record<Locale, string>> = {
    ...(arSlug ? { ar: `/ar/adhkar/${arSlug}` } : {}),
    ...(enSlug ? { en: `/en/adhkar/${enSlug}` } : {}),
  };
  const { canonical, languages } = localeAlternates(locale, pathByLocale);

  const title = display.title;
  const description = undefined;

  return {
    title,
    alternates: { canonical, languages },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale,
      url: canonical,
      title,
      ...(description != null ? { description } : {}),
      images: [{ url: "/og-image.png" }],
    },
    twitter: defaultTwitter(),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdhkarReadingPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  let azkar;
  try {
    azkar = await getAzkarBySlug(locale, decodeSlug(slug));
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  if (azkar.status !== "published") notFound();

  // Resolve per-item audio media IDs to presigned URLs in parallel.
  const resolvedItems: SerializedDhikrItem[] = await Promise.all(
    azkar.items.map(async (item): Promise<SerializedDhikrItem> => {
      const audioUrl = item.audioMediaId
        ? (await getMediaUrlById(item.audioMediaId)) ?? undefined
        : undefined;

      return {
        ar: item.ar,
        ...(item.en != null ? { en: item.en } : {}),
        ...(item.transliteration != null ? { transliteration: item.transliteration } : {}),
        repeat: item.repeat,
        ...(item.virtue != null ? { virtue: item.virtue } : {}),
        ...(item.source != null ? { source: item.source } : {}),
        ...(audioUrl != null ? { audioUrl } : {}),
      };
    }),
  );

  const display = azkar[locale];

  const serialized: SerializedAzkar = {
    id: azkar.id,
    kind: azkar.kind,
    locale,
    title: display.title,
    slug: display.slug,
    items: resolvedItems,
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <AdhkarReader azkar={serialized} />
    </div>
  );
}
