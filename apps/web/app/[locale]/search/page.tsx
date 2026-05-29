import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { searchContent } from "@repo/api/services/search";
import type { Locale } from "@repo/api/schemas/locale";

import { Link } from "@/i18n/navigation";
import { absoluteUrl } from "@/lib/seo";

// Per-request CSP nonce → dynamic render (same rationale as the other routes).
export const dynamic = "force-dynamic";

// Search result pages shouldn't be indexed.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return {
    title: t("title"),
    robots: { index: false, follow: true },
    alternates: { canonical: absoluteUrl(`/${locale}/search`) },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const t = await getTranslations("search");

  const query = (q ?? "").trim();
  const results = query
    ? await searchContent(locale, query)
    : { playlists: [], tracks: [] };
  const total = results.playlists.length + results.tracks.length;

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>

      {query.length === 0 ? (
        <p className="mt-4 text-text-2">{t("prompt")}</p>
      ) : total === 0 ? (
        <p className="mt-4 text-text-2">{t("noResults", { query })}</p>
      ) : (
        <div className="mt-8 space-y-10">
          {results.playlists.length > 0 && (
            <section aria-labelledby="playlists-heading">
              <h2
                id="playlists-heading"
                className="mb-3 text-lg font-semibold"
              >
                {t("playlists")}
              </h2>
              <ul className="divide-y divide-border">
                {results.playlists.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/playlists/${p.slug}`}
                      className="block py-3 font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.tracks.length > 0 && (
            <section aria-labelledby="tracks-heading">
              <h2 id="tracks-heading" className="mb-3 text-lg font-semibold">
                {t("tracks")}
              </h2>
              <ul className="divide-y divide-border">
                {results.tracks.map((tr) => (
                  <li key={tr.id}>
                    <Link
                      href={`/playlists/${tr.playlistSlug}`}
                      className="block py-3 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                      <span className="font-medium">{tr.title}</span>
                      <span className="ms-2 text-sm text-text-2">
                        {tr.playlistTitle}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
