import {
  DEVELOPER_CONTACT,
  developerMailto,
  developerName,
  developerTel,
  developerTitle,
} from "@repo/shared-core/developer";

import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import { NAV } from "./site-header";
import { Github, Globe, Linkedin, Mail, Phone } from "./ui/icons";

const COLUMN_HEADING_CLASS =
  "text-2xs font-medium uppercase tracking-[0.12em] text-muted";
const LIST_LINK_CLASS =
  "flex items-center gap-2 text-sm text-text-2 transition-colors hover:text-primary";

// Same destinations as the header nav, minus "home" — the brand mark already
// covers that (mirrors apps/web/features/layout/components/site-header.tsx).
const EXPLORE_ITEMS = NAV.filter((item) => item.route.view !== "home");

type BrandedFooterProps = {
  /** Adds the brand mark + Explore nav column, matching the web Ledger footer.
   * Only meaningful where the hash router is live (the new-tab dashboard) —
   * the options page has no views to link to, so it stays credit + contact. */
  withNav?: boolean;
};

// Branded developer credit shown on the new-tab dashboard and the options page.
// Contact data comes from `@repo/shared-core`; labels are localized via `useI18n`.
export function BrandedFooter({ withNav = false }: BrandedFooterProps) {
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

  const creditBlock = (
    <div className="flex flex-col gap-0.5">
      <span className={COLUMN_HEADING_CLASS}>{t("footer.builtBy")}</span>
      <span className="font-display text-lg font-semibold text-text">
        {developerName(locale)}
      </span>
      <span className="text-xs text-text-2">{developerTitle(locale)}</span>
    </div>
  );

  // `md:items-start` matters: without it, `items-center` (needed for the
  // icon-only mobile row) also centers each row once the list becomes a
  // column at md — that's what threw "Contact" out of alignment with its
  // own list before this fix. `columnClassName` lets the nav variant give
  // Contact its own full-width row below md without affecting the options
  // page's condensed 2-col layout.
  const renderContactColumn = (columnClassName = "flex flex-col gap-2.5") => (
    <nav aria-label={t("footer.contact")} className={columnClassName}>
      <h2 className={COLUMN_HEADING_CLASS}>{t("footer.contact")}</h2>
      <ul className="flex flex-row flex-wrap items-center gap-3 md:flex-col md:items-start md:gap-2">
        {contactLinks.map(({ href, label, Icon, external }) => (
          <li key={href}>
            <a
              href={href}
              className={`group -m-1 p-1 ${LIST_LINK_CLASS}`}
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              <Icon className="size-4 text-muted transition-colors group-hover:text-primary" />
              <span className="sr-only text-sm md:not-sr-only">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );

  if (!withNav) {
    return (
      <footer className="border-t border-border px-4 py-8 text-sm text-text-2">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
          {creditBlock}
          {renderContactColumn()}
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-12 md:grid-cols-[1.3fr_1fr_1fr] md:gap-8">
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => navigate({ view: "home" })}
            className="w-fit cursor-pointer font-display text-xl font-bold leading-none text-primary transition-colors hover:text-primary/80"
          >
            {t("common.appName")}
          </button>
          <p className="max-w-[26ch] text-sm text-text-2">{t("footer.tagline")}</p>
          <div className="mt-1">{creditBlock}</div>
        </div>

        <nav aria-label={t("footer.explore")} className="flex flex-col gap-2.5">
          <h2 className={COLUMN_HEADING_CLASS}>{t("footer.explore")}</h2>
          <ul className="flex flex-col gap-2">
            {EXPLORE_ITEMS.map(({ route, labelKey }) => (
              <li key={route.view}>
                <button type="button" onClick={() => navigate(route)} className={LIST_LINK_CLASS}>
                  {t(labelKey)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {renderContactColumn("col-span-2 flex flex-col gap-2.5 md:col-span-1")}
      </div>
    </footer>
  );
}
