"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

import { useLocaleAlternates } from "../locale-alternates-context";

type Locale = (typeof routing.locales)[number];

const LOCALE_LABELS: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

export function LocaleSwitcher() {
  const activeLocale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("nav");
  const alternates = useLocaleAlternates();

  const nextLocale = routing.locales.find((l) => l !== activeLocale) ?? activeLocale;

  // On a detail page the slug differs per locale, so a prefix-swap of the
  // current path would 404 in the other locale. Use the alternate path the
  // page registered. Elsewhere the path is locale-invariant — fall back to the
  // current pathname (next-intl's Link swaps the locale prefix).
  const basePath = alternates[nextLocale] ?? pathname;
  const query = searchParams.toString();
  const target = query ? `${basePath}?${query}` : basePath;

  // WCAG 2.5.3 (Label in Name): the visible label ("English"/"العربية") must be
  // part of the accessible name, or voice control can't target the control.
  const label = `${t("language")}: ${LOCALE_LABELS[nextLocale]}`;

  return (
    <Link
      href={target}
      locale={nextLocale}
      aria-label={label}
      // min-h-11 (44px) hit area on a text pill — width already exceeds 44px
      // from the label + px-3 padding, so only height needed the floor.
      className="ms-auto inline-flex min-h-11 items-center rounded-full px-3 py-1 text-sm font-medium border border-input hover:bg-accent transition-colors"
    >
      {LOCALE_LABELS[nextLocale]}
    </Link>
  );
}
