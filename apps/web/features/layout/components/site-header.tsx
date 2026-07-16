import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
// import { SearchBox } from "@/features/search/components/search-box";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";

const ICON_SIZE = 16;

// Same glyphs as the extension's header nav (apps/extension/src/components/
// ui/icons.tsx BookOpen/Radio/Globe/Clock) so the two surfaces read as one
// icon language. Qibla has no counterpart there (no qibla route in the
// extension), so it gets a compass — reads as "direction" without inventing
// new brand iconography.
function QuranIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function RadioIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5 18 3M6 8.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <circle cx="8" cy="14" r="3" />
      <path d="M16 12.5h2M16 15.5h2" />
    </svg>
  );
}

function AdhkarIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function PrayerIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function QiblaIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1.5 text-sm font-medium text-text-2 hover:text-primary whitespace-nowrap transition-colors";

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
    { href: "/quran", label: tQuran("navLabel"), Icon: QuranIcon },
    { href: "/radio", label: tRadio("nav"), Icon: RadioIcon },
    { href: "/adhkar", label: adhkarT("navLabel"), Icon: AdhkarIcon },
    { href: "/prayer-times", label: tPrayer("nav"), Icon: PrayerIcon },
    { href: "/qibla", label: tQibla("nav"), Icon: QiblaIcon },
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
              <item.Icon />
              {item.label}
            </Link>
          ))}
          {/* <SearchBox /> */}
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          {/* MobileNav is a Client Component — a bare component reference (Icon)
              can't cross that boundary as a prop, only a rendered element can. */}
          <MobileNav
            items={navItems.map(({ href, label, Icon }) => ({
              href,
              label,
              icon: <Icon />,
            }))}
            menuLabel={t("menu")}
          />
        </div>
      </div>
    </header>
  );
}
