import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mutable mock state shared across the mocked modules. Declared via vi.hoisted
// so it exists when the (hoisted) vi.mock factories run.
const state = vi.hoisted(() => ({
  pathname: "/",
  locale: "ar" as "ar" | "en",
  alternates: {} as Record<string, string>,
  query: "",
}));

// Render the locale-aware Link as a plain anchor so we can assert the resolved
// href and the locale it would switch to.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, locale, children, ...rest }: { href: string; locale: string; children: React.ReactNode }) => (
    <a href={href} data-locale={locale} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => state.pathname,
}));

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["ar", "en"], defaultLocale: "ar" },
}));

vi.mock("next-intl", () => ({
  useLocale: () => state.locale,
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.query),
}));

vi.mock("../locale-alternates-context", () => ({
  useLocaleAlternates: () => state.alternates,
}));

import { LocaleSwitcher } from "./locale-switcher";

beforeEach(() => {
  state.pathname = "/";
  state.locale = "ar";
  state.alternates = {};
  state.query = "";
});

describe("LocaleSwitcher", () => {
  it("falls back to a plain prefix-swap of the current path when no alternates are registered", () => {
    render(<LocaleSwitcher />);

    const link = screen.getByRole("link", { name: "language" });
    expect(link).toHaveAttribute("href", "/");
    // Active locale is ar, so it offers to switch to en.
    expect(link).toHaveAttribute("data-locale", "en");
    expect(link).toHaveTextContent("English");
  });

  it("routes to the other locale's registered slug on a detail page (no 404)", () => {
    state.pathname = "/playlists/الفاتحة";
    state.alternates = { en: "/playlists/al-fatiha", ar: "/playlists/الفاتحة" };

    render(<LocaleSwitcher />);

    const link = screen.getByRole("link", { name: "language" });
    // Uses the en alternate, NOT the current arabic-slug pathname.
    expect(link).toHaveAttribute("href", "/playlists/al-fatiha");
    expect(link).toHaveAttribute("data-locale", "en");
  });

  it("offers Arabic when the active locale is English", () => {
    state.locale = "en";

    render(<LocaleSwitcher />);

    const link = screen.getByRole("link", { name: "language" });
    expect(link).toHaveAttribute("data-locale", "ar");
    expect(link).toHaveTextContent("العربية");
  });

  it("preserves the current query string on the fallback path", () => {
    state.query = "category=quran";

    render(<LocaleSwitcher />);

    const link = screen.getByRole("link", { name: "language" });
    expect(link).toHaveAttribute("href", "/?category=quran");
  });
});
