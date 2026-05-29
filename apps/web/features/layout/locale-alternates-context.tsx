"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { routing } from "@/i18n/routing";

type Locale = (typeof routing.locales)[number];
type Alternates = Partial<Record<Locale, string>>;

type ContextValue = {
  alternates: Alternates;
  setAlternates: (next: Alternates | null) => void;
};

const LocaleAlternatesContext = createContext<ContextValue | null>(null);

/*
 * Bridges the per-locale slug of a detail page up to the locale switcher in the
 * site header. The header is rendered above the route's children, so a detail
 * page cannot pass the alternate-locale slug to the switcher via props. Instead
 * the page registers its `{ ar, en }` pathnames here and the switcher reads
 * them. List/home routes register nothing, so the switcher falls back to a
 * plain locale prefix-swap (their path is locale-invariant).
 */
export function LocaleAlternatesProvider({ children }: { children: ReactNode }) {
  const [alternates, setAlternates] = useState<Alternates>({});
  return (
    <LocaleAlternatesContext.Provider
      value={{ alternates, setAlternates: (next) => setAlternates(next ?? {}) }}
    >
      {children}
    </LocaleAlternatesContext.Provider>
  );
}

// Reader for the switcher. Returns {} when no detail page has registered slugs.
export function useLocaleAlternates(): Alternates {
  const ctx = useContext(LocaleAlternatesContext);
  return ctx?.alternates ?? {};
}

// Registers the per-locale pathnames (without locale prefix) on mount and
// clears them on unmount. Rendered by a detail page; returns no DOM.
export function SetLocaleAlternates({ alternates }: { alternates: Alternates }) {
  const ctx = useContext(LocaleAlternatesContext);
  const setAlternates = ctx?.setAlternates;
  const ar = alternates.ar;
  const en = alternates.en;

  useEffect(() => {
    if (!setAlternates) return;
    setAlternates({
      ...(ar != null ? { ar } : {}),
      ...(en != null ? { en } : {}),
    });
    return () => setAlternates(null);
  }, [setAlternates, ar, en]);

  return null;
}
