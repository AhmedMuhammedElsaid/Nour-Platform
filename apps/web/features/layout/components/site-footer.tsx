import { getLocale, getTranslations } from "next-intl/server";
import { isLocale } from "@repo/shared-core/schemas/locale";
import {
  DEVELOPER_CONTACT,
  developerMailto,
  developerName,
  developerTel,
  developerTitle,
} from "@repo/shared-core/developer";

import { Link } from "@/i18n/navigation";

const ICON_SIZE = 16;

// Brand marks (fill) + feather-style glyphs (stroke). Inline SVG keeps the footer
// dependency-free and matches the repo icon convention (see theme-toggle.tsx).
function LinkedInIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

const BRAND: Record<string, { text: string; lang: string }> = {
  ar: { text: "نور", lang: "ar" },
  en: { text: "Nour", lang: "en" },
};

const COLUMN_HEADING_CLASS =
  "text-2xs font-medium uppercase tracking-[0.12em] text-muted";
const LIST_LINK_CLASS =
  "flex items-center gap-2 text-sm text-text-2 transition-colors hover:text-primary focus-visible:text-primary";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const tQuran = await getTranslations("quran");
  const tRadio = await getTranslations("radio");
  const tAdhkar = await getTranslations("adhkar");
  const tPrayer = await getTranslations("prayer");
  const tQibla = await getTranslations("qibla");
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "ar";
  const brand = BRAND[locale] ?? BRAND.en!;

  // Mirrors the header's nav so the two never drift (see site-header.tsx).
  const exploreLinks = [
    { href: "/quran", label: tQuran("navLabel") },
    { href: "/radio", label: tRadio("nav") },
    { href: "/adhkar", label: tAdhkar("navLabel") },
    { href: "/prayer-times", label: tPrayer("nav") },
    { href: "/qibla", label: tQibla("nav") },
  ];

  // `external` drives target/rel — mailto/tel must stay in the same tab.
  const contactLinks = [
    {
      href: DEVELOPER_CONTACT.links.linkedin,
      label: t("linkedin"),
      Icon: LinkedInIcon,
      external: true,
    },
    {
      href: DEVELOPER_CONTACT.links.github,
      label: t("github"),
      Icon: GitHubIcon,
      external: true,
    },
    {
      href: DEVELOPER_CONTACT.links.portfolio,
      label: t("portfolio"),
      Icon: GlobeIcon,
      external: true,
    },
    { href: developerMailto, label: t("email"), Icon: MailIcon, external: false },
    { href: developerTel, label: t("phone"), Icon: PhoneIcon, external: false },
  ];

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr] md:gap-8">
        <div className="flex flex-col gap-2.5">
          <Link
            href="/"
            className="w-fit font-display text-xl font-bold leading-none text-primary transition-colors hover:text-primary/80"
            aria-label={tNav("home")}
          >
            <span lang={brand.lang}>{brand.text}</span>
          </Link>
          <p className="max-w-[26ch] text-sm text-text-2">{t("tagline")}</p>

          <div className="mt-1 flex flex-col gap-0.5">
            <span className={COLUMN_HEADING_CLASS}>{t("builtBy")}</span>
            <span className="font-display text-lg font-semibold text-text">
              {developerName(locale)}
            </span>
            <span className="text-xs text-text-2">{developerTitle(locale)}</span>
          </div>
        </div>

        <nav aria-label={t("explore")} className="flex flex-col gap-2.5">
          <h2 className={COLUMN_HEADING_CLASS}>{t("explore")}</h2>
          <ul className="flex flex-col gap-2">
            {exploreLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={LIST_LINK_CLASS}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("contact")} className="col-span-2 flex flex-col gap-2.5 md:col-span-1">
          <h2 className={COLUMN_HEADING_CLASS}>{t("contact")}</h2>
          {/* Icon-only row below md — labels stay for screen readers via sr-only;
              md+ reverts to the labelled column list. */}
          <ul className="flex flex-row flex-wrap items-center gap-3 md:flex-col md:items-start md:gap-2">
            {contactLinks.map(({ href, label, Icon, external }) => (
              <li key={href}>
                <a
                  href={href}
                  className="group -m-1 flex items-center gap-2 p-1 text-text-2 transition-colors hover:text-primary focus-visible:text-primary"
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  <span className="text-muted transition-colors group-hover:text-primary">
                    <Icon />
                  </span>
                  <span className="sr-only text-sm md:not-sr-only">{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 text-xs text-muted sm:px-6">
        <span>{t("copyright", { year: new Date().getFullYear() })}</span>
        <Link
          href="/privacy"
          className="transition-colors hover:text-primary focus-visible:text-primary"
        >
          {t("privacy")}
        </Link>
      </div>
    </footer>
  );
}
