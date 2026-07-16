// Branded developer credit shown at the bottom of the Home screen. Contact data
// comes from `@repo/shared-core`; labels are localized via react-i18next. Icons
// take a theme-derived colour (SVG can't read NativeWind classes — see
// bottom-tab-bar.tsx / tab-icons.tsx for the same pattern).

import { useTranslation } from "react-i18next";
import { Linking, Pressable, View } from "react-native";

import {
  DEVELOPER_CONTACT,
  developerMailto,
  developerName,
  developerTel,
  developerTitle,
} from "@repo/shared-core/developer";

import {
  GithubIcon,
  GlobeIcon,
  LinkedinIcon,
  MailIcon,
  PhoneIcon,
} from "@/components/icons/social-icons";
import { Text } from "@/components/ui/text";
import { initialLocale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";

// Same origin fallback as lib/api.ts's API_ORIGIN, inlined rather than imported —
// several tests mock "@/lib/api" down to just `{ getJson }`, and importing
// assetUrl from there would resolve to undefined under those mocks.
const WEB_ORIGIN = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export function DeveloperFooter() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const locale = initialLocale;

  // Matches --color-muted in packages/ui tokens (dark / light).
  const iconColor = theme === "dark" ? "#5a4a38" : "#6b7670";

  const links = [
    { key: "linkedin", url: DEVELOPER_CONTACT.links.linkedin, Icon: LinkedinIcon },
    { key: "github", url: DEVELOPER_CONTACT.links.github, Icon: GithubIcon },
    { key: "portfolio", url: DEVELOPER_CONTACT.links.portfolio, Icon: GlobeIcon },
    { key: "email", url: developerMailto, Icon: MailIcon },
    { key: "phone", url: developerTel, Icon: PhoneIcon },
  ] as const;

  // No in-app privacy screen — mobile only talks to web's /api/v1 + shared-core
  // (CLAUDE.md boundary), so this opens the web page externally like the other
  // contact links already do.
  const privacyUrl = `${WEB_ORIGIN}/${locale}/privacy`;

  // Condensed variant of the web Ledger footer: credit block + a labelled contact
  // list, side by side in a row (no nav column — the tab bar covers navigation),
  // plus the copyright/privacy baseline bar.
  return (
    <View className="mt-8 gap-6">
      <View className="flex-row gap-6 border-t border-border pt-6">
        <View className="flex-1 gap-0.5">
          <Text variant="label" className="text-text-2">
            {t("footer.builtBy")}
          </Text>
          <Text variant="title">{developerName(locale)}</Text>
          <Text variant="muted">{developerTitle(locale)}</Text>
        </View>

        <View className="gap-2.5">
          <Text variant="label" className="text-text-2">
            {t("footer.contact")}
          </Text>
          {/* Icon-only row — no visible labels; accessibilityLabel still carries
              the name to screen readers. */}
          <View className="flex-row flex-wrap gap-4">
            {links.map(({ key, url, Icon }) => (
              <Pressable
                key={key}
                onPress={() => void Linking.openURL(url)}
                accessibilityRole="link"
                accessibilityLabel={t(`footer.${key}`)}
                hitSlop={8}
              >
                <Icon color={iconColor} size={18} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between border-t border-border pt-4">
        <Text variant="muted">
          {t("footer.copyright", { year: new Date().getFullYear() })}
        </Text>
        <Pressable
          onPress={() => void Linking.openURL(privacyUrl)}
          accessibilityRole="link"
          accessibilityLabel={t("footer.privacy")}
          hitSlop={8}
        >
          <Text variant="muted">{t("footer.privacy")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
