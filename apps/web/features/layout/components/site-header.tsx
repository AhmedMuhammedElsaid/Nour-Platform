import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  return (
    <header className="sticky top-0 z-40 w-full bg-bg/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
        <Link
          href="/"
          className="font-display text-lg leading-none text-text hover:text-primary transition-colors"
          aria-label={t("home")}
        >
          <span lang="ar" className="me-1">نور</span>
          <span>Nour</span>
        </Link>
      </div>
    </header>
  );
}
