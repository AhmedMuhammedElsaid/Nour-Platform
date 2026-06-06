import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
// import { SearchBox } from "@/features/search/components/search-box";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

const NAV_LINK_CLASS =
  "text-sm font-medium text-text-2 hover:text-primary whitespace-nowrap transition-colors";

const BRAND: Record<string, { text: string; lang: string }> = {
  ar: { text: "نور", lang: "ar" },
  en: { text: "Nour", lang: "en" },
};

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const adhkarT = await getTranslations("adhkar");
  const tPrayer = await getTranslations("prayer");
  const locale = await getLocale();
  const brand = BRAND[locale] ?? BRAND.en!;

  return (
    <header className="sticky top-0 z-40 w-full bg-bg/85 backdrop-blur-lg border-b border-border">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link
          href="/"
          className="font-display text-xl font-bold leading-none text-primary hover:text-primary/80 transition-colors"
          aria-label={t("home")}
        >
          <span lang={brand.lang}>{brand.text}</span>
        </Link>

        <nav aria-label={t("primary")} className="flex items-center gap-5">
          <Link href="/adhkar" className={NAV_LINK_CLASS}>
            {adhkarT("navLabel")}
          </Link>
          <Link href="/prayer-times" className={NAV_LINK_CLASS}>
            {tPrayer("nav")}
          </Link>
          {/* <SearchBox /> */}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
