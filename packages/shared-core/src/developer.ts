// Branded developer credit shown in the footer of every surface (web, extension,
// mobile). Contact data is identical across apps, so it lives here once; only the
// short UI labels ("Built by", aria-labels) are localized per-app. Name/title carry
// both locales so the strings aren't triplicated across the three i18n catalogs.

import type { Locale } from "./schemas/locale";

export const DEVELOPER_CONTACT = {
  name: { ar: "أحمد محمد السعيد", en: "Ahmed Muhammed Elsaid" },
  title: { ar: "مهندس برمجيات أول", en: "Staff Software Engineer" },
  email: "ahmed.muhammed.elsaid@gmail.com",
  phone: "+201017134627",
  links: {
    linkedin: "https://www.linkedin.com/in/ahmedmuhammedelsaid",
    github: "https://github.com/AhmedMuhammedElsaid",
    portfolio: "https://ahmed-muhammed-elsaid.netlify.app",
  },
} as const;

/** Localized display name for the current locale. */
export function developerName(locale: Locale): string {
  return DEVELOPER_CONTACT.name[locale];
}

/** Localized role/title for the current locale. */
export function developerTitle(locale: Locale): string {
  return DEVELOPER_CONTACT.title[locale];
}

export const developerMailto = `mailto:${DEVELOPER_CONTACT.email}` as const;
export const developerTel = `tel:${DEVELOPER_CONTACT.phone}` as const;
