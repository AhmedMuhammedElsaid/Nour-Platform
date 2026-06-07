import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@repo/api/schemas/locale";
import { BookmarksList } from "@/features/quran/components/bookmarks-list";

export const dynamic = "force-dynamic";

export default async function BookmarksPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quran");
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-text mb-6 text-2xl font-bold">{t("bookmarks")}</h1>
      <BookmarksList />
    </div>
  );
}
