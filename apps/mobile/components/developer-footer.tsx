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

export function DeveloperFooter() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const locale = initialLocale;

  // Matches --color-text-2 in packages/ui tokens (dark / light).
  const iconColor = theme === "dark" ? "#8a7a62" : "#3f4a44";

  const links = [
    { key: "linkedin", url: DEVELOPER_CONTACT.links.linkedin, Icon: LinkedinIcon },
    { key: "github", url: DEVELOPER_CONTACT.links.github, Icon: GithubIcon },
    { key: "portfolio", url: DEVELOPER_CONTACT.links.portfolio, Icon: GlobeIcon },
    { key: "email", url: developerMailto, Icon: MailIcon },
    { key: "phone", url: developerTel, Icon: PhoneIcon },
  ] as const;

  return (
    <View className="mt-8 items-center gap-4 border-t border-border pt-6">
      <View className="items-center gap-0.5">
        <Text variant="label" className="text-text-2">
          {t("footer.builtBy")}
        </Text>
        <Text variant="title">{developerName(locale)}</Text>
        <Text variant="muted">{developerTitle(locale)}</Text>
      </View>

      <View className="flex-row items-center gap-6">
        {links.map(({ key, url, Icon }) => (
          <Pressable
            key={key}
            onPress={() => void Linking.openURL(url)}
            accessibilityRole="link"
            accessibilityLabel={t(`footer.${key}`)}
            hitSlop={8}
          >
            <Icon color={iconColor} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
