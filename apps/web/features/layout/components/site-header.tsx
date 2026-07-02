import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
// import { SearchBox } from "@/features/search/components/search-box";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";
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
  const tQuran = await getTranslations("quran");
  const tQibla = await getTranslations("qibla");
  const tRadio = await getTranslations("radio");
  const locale = await getLocale();
  const brand = BRAND[locale] ?? BRAND.en!;

  const navItems = [
    { href: "/quran", label: tQuran("navLabel") },
    { href: "/radio", label: tRadio("nav") },
    { href: "/adhkar", label: adhkarT("navLabel") },
    { href: "/prayer-times", label: tPrayer("nav") },
    { href: "/qibla", label: tQibla("nav") },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-bg/85 backdrop-blur-lg border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3 sm:gap-6">
        <Link
          href="/"
          className="shrink-0 font-display text-xl font-bold leading-none text-primary hover:text-primary/80 transition-colors"
          aria-label={t("home")}
        >
          <span lang={brand.lang}>{brand.text}</span>
        </Link>

        {/* Inline tabs on ≥sm only. On mobile the four tabs would overflow the
            viewport and give the whole page a horizontal scroll, so they collapse
            into the MobileNav hamburger below instead. */}
        <nav aria-label={t("primary")} className="hidden items-center gap-5 sm:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={NAV_LINK_CLASS}>
              {item.label}
            </Link>
          ))}
          {/* <SearchBox /> */}
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <MobileNav items={navItems} menuLabel={t("menu")} />
        </div>
      </div>
    </header>
  );
}
