"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  const [alternates, setAlternatesState] = useState<Alternates>({});

  // Stable identity matters: this setter is a dependency of SetLocaleAlternates'
  // effect. An inline arrow recreated each render would change that dependency
  // every render, re-firing the effect, which writes a fresh object — an
  // endless render→effect→setState loop ("Maximum update depth exceeded").
  const setAlternates = useCallback(
    (next: Alternates | null) => setAlternatesState(next ?? {}),
    [],
  );

  const value = useMemo<ContextValue>(
    () => ({ alternates, setAlternates }),
    [alternates, setAlternates],
  );

  return (
    <LocaleAlternatesContext.Provider value={value}>
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
