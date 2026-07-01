import { getLocale, getTranslations } from "next-intl/server";
import { isLocale } from "@repo/shared-core/schemas/locale";
import {
  DEVELOPER_CONTACT,
  developerMailto,
  developerName,
  developerTel,
  developerTitle,
} from "@repo/shared-core/developer";

const ICON_SIZE = 20;

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

const linkClass =
  "text-text-2 transition-colors hover:text-primary focus-visible:text-primary";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "ar";

  return (
    <footer className="flex flex-col items-center gap-4 border-t border-border py-8 text-sm text-text-2">
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-xs uppercase tracking-wide text-text-2">
          {t("builtBy")}
        </span>
        <span className="font-display text-base font-semibold text-text">
          {developerName(locale)}
        </span>
        <span className="text-xs text-text-2">{developerTitle(locale)}</span>
      </div>

      <nav aria-label={t("builtBy")} className="flex items-center gap-5">
        <a
          href={DEVELOPER_CONTACT.links.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("linkedin")}
          className={linkClass}
        >
          <LinkedInIcon />
        </a>
        <a
          href={DEVELOPER_CONTACT.links.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("github")}
          className={linkClass}
        >
          <GitHubIcon />
        </a>
        <a
          href={DEVELOPER_CONTACT.links.portfolio}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("portfolio")}
          className={linkClass}
        >
          <GlobeIcon />
        </a>
        <a href={developerMailto} aria-label={t("email")} className={linkClass}>
          <MailIcon />
        </a>
        <a href={developerTel} aria-label={t("phone")} className={linkClass}>
          <PhoneIcon />
        </a>
      </nav>
    </footer>
  );
}
