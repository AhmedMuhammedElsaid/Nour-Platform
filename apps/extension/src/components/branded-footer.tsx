import {
  DEVELOPER_CONTACT,
  developerMailto,
  developerName,
  developerTel,
  developerTitle,
} from "@repo/shared-core/developer";

import { useI18n } from "../lib/i18n";
import { Github, Globe, Linkedin, Mail, Phone } from "./ui/icons";

const linkClass = "text-text-2 transition-colors hover:text-primary";

// Branded developer credit shown on the new-tab dashboard and the options page.
// Contact data comes from `@repo/shared-core`; labels are localized via `useI18n`.
export function BrandedFooter() {
  const { t, locale } = useI18n();

  return (
    <footer className="flex flex-col items-center gap-4 border-t border-border px-4 py-8 text-sm text-text-2">
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-xs uppercase tracking-[0.08em] text-text-2">
          {t("footer.builtBy")}
        </span>
        <span className="font-display text-base font-semibold text-text">
          {developerName(locale)}
        </span>
        <span className="text-xs text-text-2">{developerTitle(locale)}</span>
      </div>

      <nav aria-label={t("footer.builtBy")} className="flex items-center gap-5">
        <a
          href={DEVELOPER_CONTACT.links.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("footer.linkedin")}
          className={linkClass}
        >
          <Linkedin className="size-5" />
        </a>
        <a
          href={DEVELOPER_CONTACT.links.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("footer.github")}
          className={linkClass}
        >
          <Github className="size-5" />
        </a>
        <a
          href={DEVELOPER_CONTACT.links.portfolio}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("footer.portfolio")}
          className={linkClass}
        >
          <Globe className="size-5" />
        </a>
        <a href={developerMailto} aria-label={t("footer.email")} className={linkClass}>
          <Mail className="size-5" />
        </a>
        <a href={developerTel} aria-label={t("footer.phone")} className={linkClass}>
          <Phone className="size-5" />
        </a>
      </nav>
    </footer>
  );
}
