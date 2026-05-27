import Link from "next/link";

import { listCategories } from "@repo/api/services/category";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@repo/api/schemas/locale";

import { PlaylistForm } from "../../../features/playlists/components/playlist-form";

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce that
// would mismatch a cached static body, and the deploy build runs without an
// Atlas connection — both reasons require dynamic rendering.
export const dynamic = "force-dynamic";

interface Props {
  // `?contentId=&locale=` seed the "create translation" flow: a new document
  // linked to an existing program's contentId in the requested locale.
  searchParams: Promise<{ contentId?: string; locale?: string }>;
}

export default async function NewPlaylistPage({ searchParams }: Props) {
  const { contentId, locale: localeParam } = await searchParams;
  const locale: Locale =
    localeParam && isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

  const categories = await listCategories(locale);
  const availableCategories = categories.map((c) => ({
    id: c.contentId,
    name: c.name,
  }));

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/playlists"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Playlists
        </Link>
        <h1 className="text-2xl font-semibold">
          {contentId ? "New playlist translation" : "New playlist"}
        </h1>
      </div>
      <PlaylistForm
        mode="create"
        availableCategories={availableCategories}
        defaultValues={{ locale, ...(contentId ? { contentId } : {}) }}
      />
    </main>
  );
}
