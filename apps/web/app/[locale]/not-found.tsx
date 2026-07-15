import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

/*
 * Localized 404 for everything under /[locale]. Reached either by an explicit
 * notFound() (e.g. an unknown playlist slug) or by the [...rest] catch-all that
 * swallows unmatched paths inside a valid locale. next-intl resolves the locale
 * from the segment, so no params prop is needed (not-found.tsx never gets one).
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("errors");

  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[3px] text-primary">
        {t("notFoundEyebrow")}
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight text-text">
        {t("notFoundTitle")}
      </h1>
      <hr className="my-8 border-border" />
      <p className="mb-8 max-w-prose text-base leading-relaxed text-text-2">
        {t("notFoundDescription")}
      </p>
      <Link
        href="/"
        className="text-base font-medium text-primary underline underline-offset-4 hover:text-primary/80"
      >
        {t("backHome")}
      </Link>
    </section>
  );
}
