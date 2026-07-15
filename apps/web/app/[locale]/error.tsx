"use client";

import { useTranslations } from "next-intl";

import { Button } from "@repo/ui/primitives/button";

/*
 * Error boundary for the /[locale] subtree. It renders INSIDE the locale layout,
 * so the intl provider, header/footer chrome and <html dir> are all still there.
 * A crash in the layout itself escapes this boundary and lands in
 * app/global-error.tsx instead.
 *
 * `error` is required by Next's error-boundary contract even though we don't
 * surface its message: digests are server-side detail, not user-facing copy.
 */
export default function LocaleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[3px] text-primary">
        {t("errorEyebrow")}
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight text-text">
        {t("title")}
      </h1>
      <hr className="my-8 border-border" />
      <p className="mb-8 max-w-prose text-base leading-relaxed text-text-2">
        {t("description")}
      </p>
      <Button onClick={() => reset()}>{t("retry")}</Button>
    </section>
  );
}
