import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="flex flex-col items-center gap-1 border-t border-border py-6 text-sm text-text-2">
      {/* Year is computed at render; pages are force-dynamic so it never goes stale. */}
      <p>{t("copyright", { year: new Date().getFullYear() })}</p>
      <Link
        href="/privacy"
        className="underline underline-offset-4 hover:text-foreground"
      >
        {t("privacy")}
      </Link>
    </footer>
  );
}
