import { notFound } from "next/navigation";

/*
 * next-intl's recommended catch-all: without it an unmatched path inside a
 * valid locale (e.g. /ar/typo) bubbles to the ROOT not-found, which renders
 * outside the [locale] layout with no intl context — i.e. Next's bare English
 * LTR default. Matching it here keeps the miss inside the localized tree so
 * app/[locale]/not-found.tsx renders with header, footer and RTL intact.
 */
export default function CatchAllRoute() {
  notFound();
}
