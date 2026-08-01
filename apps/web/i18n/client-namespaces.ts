/*
 * The next-intl namespaces shipped to the browser via NextIntlClientProvider.
 *
 * Server components read strings through `getTranslations`, a separate
 * request-scoped server store, so the client provider only needs the
 * namespaces a `"use client"` component actually calls `useTranslations` on —
 * 12 of the 16 in `messages/*.json`. `metadata`, `footer`, `playlist` and
 * `privacy` are server-only.
 *
 * Getting this wrong fails at RUNTIME and nowhere else: next-intl throws on a
 * missing key, which neither typecheck nor the build can see. That is why this
 * list lives in its own module with `client-namespaces.test.ts` asserting it
 * against a scan of every `useTranslations("…")` call in the app — if you add
 * a client component reading a new namespace, that test goes red instead of
 * production. Do not widen this back to the whole catalogue "to be safe".
 */
export const CLIENT_MESSAGE_NAMESPACES = [
  "nav",
  "home",
  "categories",
  "search",
  "player",
  "prayer",
  "pwa",
  "adhkar",
  "quran",
  "qibla",
  "radio",
  "errors",
] as const;
