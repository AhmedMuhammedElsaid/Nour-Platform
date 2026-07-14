import type { ComponentType } from "react";

import { navigate } from "../lib/router";
import type { Route } from "../lib/router";
import { useI18n } from "../lib/i18n";
import { ThemeToggle } from "./theme-toggle";
import { BookOpen, Clock, Globe, Home, Search } from "./ui/icons";

type NavItem = { route: Route; labelKey: string; Icon: ComponentType<{ className?: string }> };

const NAV: NavItem[] = [
  { route: { view: "home" }, labelKey: "nav.home", Icon: Home },
  { route: { view: "quran" }, labelKey: "nav.quran", Icon: BookOpen },
  { route: { view: "adhkar" }, labelKey: "nav.adhkar", Icon: Globe },
  { route: { view: "prayer-times" }, labelKey: "nav.prayer", Icon: Clock },
];

type SiteHeaderProps = {
  activeView: Route["view"];
};

export function SiteHeader({ activeView }: SiteHeaderProps) {
  const { t, locale, setLocale } = useI18n();

  const toggleLocale = (): void => setLocale(locale === "ar" ? "en" : "ar");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        {/* Logo */}
        <button
          type="button"
          onClick={() => navigate({ view: "home" })}
          className="me-2 cursor-pointer font-display text-lg font-bold text-primary focus-visible:outline-none"
          aria-label={t("common.appName")}
        >
          {t("common.appName")}
        </button>

        {/* Nav */}
        <nav aria-label="القائمة الرئيسية" className="hidden items-center gap-1 sm:flex">
          {NAV.map(({ route, labelKey, Icon }) => {
            const isCurrent = activeView === route.view;
            return (
              <button
                key={route.view}
                type="button"
                onClick={() => navigate(route)}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isCurrent
                    ? "bg-primary/10 text-primary"
                    : "text-text-2 hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Icon className="size-3.5" />
                {t(labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          {/* Search */}
          <button
            type="button"
            onClick={() => navigate({ view: "search", q: "" })}
            aria-label={t("common.search")}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded text-text-2 hover:bg-surface-2 hover:text-text"
          >
            <Search className="size-4" />
          </button>

          {/* Locale toggle */}
          <button
            type="button"
            onClick={toggleLocale}
            aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded text-text-2 hover:bg-surface-2 hover:text-text"
          >
            <span className="text-xs font-semibold">{locale === "ar" ? "EN" : "ع"}</span>
          </button>

          {/* Theme */}
          <ThemeToggle label={t} />
        </div>
      </div>
    </header>
  );
}
