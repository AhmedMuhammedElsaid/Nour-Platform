import {
  DEVELOPER_CONTACT,
  developerMailto,
  developerName,
  developerTel,
  developerTitle,
} from "@repo/shared-core/developer";

import { useI18n } from "../lib/i18n";
import { Github, Globe, Linkedin, Mail, Phone } from "./ui/icons";

const COLUMN_HEADING_CLASS =
  "text-2xs font-medium uppercase tracking-[0.12em] text-muted";
const LIST_LINK_CLASS =
  "group flex items-center gap-2 text-sm text-text-2 transition-colors hover:text-primary";

// Branded developer credit shown on the new-tab dashboard and the options page.
// Contact data comes from `@repo/shared-core`; labels are localized via `useI18n`.
// Condensed variant of the web Ledger footer: no brand nav column — the new tab
// already carries its own sections and the options page has nowhere to navigate.
export function BrandedFooter() {
  const { t, locale } = useI18n();

  const contactLinks = [
    {
      href: DEVELOPER_CONTACT.links.linkedin,
      label: t("footer.linkedin"),
      Icon: Linkedin,
      external: true,
    },
    {
      href: DEVELOPER_CONTACT.links.github,
      label: t("footer.github"),
      Icon: Github,
      external: true,
    },
    {
      href: DEVELOPER_CONTACT.links.portfolio,
      label: t("footer.portfolio"),
      Icon: Globe,
      external: true,
    },
    {
      href: developerMailto,
      label: t("footer.email"),
      Icon: Mail,
      external: false,
    },
    {
      href: developerTel,
      label: t("footer.phone"),
      Icon: Phone,
      external: false,
    },
  ];

  return (
    <footer className="border-t border-border px-4 py-8 text-sm text-text-2">
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <span className={COLUMN_HEADING_CLASS}>{t("footer.builtBy")}</span>
          <span className="font-display text-lg font-semibold text-text">
            {developerName(locale)}
          </span>
          <span className="text-xs text-text-2">{developerTitle(locale)}</span>
        </div>

        <nav aria-label={t("footer.contact")} className="flex flex-col gap-2.5">
          <h2 className={COLUMN_HEADING_CLASS}>{t("footer.contact")}</h2>
          <ul className="flex flex-col gap-2">
            {contactLinks.map(({ href, label, Icon, external }) => (
              <li key={href}>
                <a
                  href={href}
                  className={LIST_LINK_CLASS}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  <Icon className="size-4 text-muted transition-colors group-hover:text-primary" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
