import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";

const BRAND: Record<string, { text: string; lang: string }> = {
  ar: { text: "نور", lang: "ar" },
  en: { text: "Nour", lang: "en" },
};

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const brand = BRAND[locale] ?? BRAND.en!;

  return (
    <header className="sticky top-0 z-40 w-full bg-bg/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
        <Link
          href="/"
          className="font-display text-lg leading-none text-text hover:text-primary transition-colors"
          aria-label={t("home")}
        >
          <span lang={brand.lang}>{brand.text}</span>
        </Link>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
