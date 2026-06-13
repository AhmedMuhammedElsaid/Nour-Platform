// SoundCloud-style bottom tab bar. Presentational nav rendered in the root
// layout (see components/bottom-dock.tsx) rather than an expo-router <Tabs>
// navigator — this avoids restructuring every route into a (tabs) group and
// keeps the existing nested Quran/Adhkar/Playlist stacks + deep links intact.
// Active tab is derived from usePathname(); switching uses router.navigate()
// so revisiting an already-open destination pops back to it (state preserved)
// instead of pushing an ever-growing stack.

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter } from "expo-router";
import { Animated, Pressable, View } from "react-native";

import {
  AdhkarIcon,
  DownloadsIcon,
  HomeIcon,
  PrayerIcon,
  QuranIcon,
} from "@/components/icons/tab-icons";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";

type TabIcon = (props: { color: string; size?: number }) => React.ReactElement;

type TabDef = {
  key: string;
  href: "/" | "/quran" | "/adhkar" | "/prayer-times" | "/downloads";
  Icon: TabIcon;
  labelKey: string;
};

const TABS: readonly TabDef[] = [
  { key: "home", href: "/", Icon: HomeIcon, labelKey: "nav.home" },
  { key: "quran", href: "/quran", Icon: QuranIcon, labelKey: "nav.quran" },
  { key: "adhkar", href: "/adhkar", Icon: AdhkarIcon, labelKey: "nav.adhkar" },
  { key: "prayer", href: "/prayer-times", Icon: PrayerIcon, labelKey: "nav.prayerTimes" },
  { key: "downloads", href: "/downloads", Icon: DownloadsIcon, labelKey: "nav.downloads" },
];

// The five top-level destinations where the tab bar is shown. On any deeper
// route (e.g. /quran/reader, /playlist/[slug], /adhkar/[slug]) the bar hides so
// detail screens get the full height. Exported for the dock + tests.
export const TAB_ROOTS: readonly string[] = TABS.map((t) => t.href);

export function isTabRoot(pathname: string): boolean {
  // Normalise a possible trailing slash ("/quran/" -> "/quran"); keep "/" as-is.
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return TAB_ROOTS.includes(p);
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabBar({ bottomInset = 0 }: { bottomInset?: number }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // SVG strokes can't read NativeWind classes (see tab-icons.tsx / sun-arc.tsx),
  // so map the active/inactive icon colours from the resolved token palette.
  // Active sits on the gold pill -> primary-foreground; inactive -> muted.
  const activeColor = theme === "dark" ? "#0f0d0a" : "#ffffff";
  const inactiveColor = theme === "dark" ? "#5a4a38" : "#6b7670";

  return (
    <View
      className="flex-row border-t border-border bg-surface px-2 pt-2"
      style={{ paddingBottom: bottomInset + 8 }}
      accessibilityRole="tablist"
    >
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <TabItem
            key={tab.key}
            label={t(tab.labelKey)}
            active={active}
            Icon={tab.Icon}
            iconColor={active ? activeColor : inactiveColor}
            onPress={() => {
              if (!active) router.navigate(tab.href);
            }}
          />
        );
      })}
    </View>
  );
}

function TabItem({
  label,
  active,
  Icon,
  iconColor,
  onPress,
}: {
  label: string;
  active: boolean;
  Icon: TabIcon;
  iconColor: string;
  onPress: () => void;
}) {
  // 0 -> inactive, 1 -> active. Drives the gold pill (opacity + scale) and a
  // subtle lift/scale of the icon. Native driver: only opacity + transform.
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 140,
    }).start();
  }, [active, anim]);

  const pillScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const iconLift = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const iconScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center gap-1 py-1"
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <View className="h-9 w-16 items-center justify-center">
        {/* Animated gold pill behind the active icon */}
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 rounded-2xl bg-primary"
          style={{ opacity: anim, transform: [{ scale: pillScale }] }}
        />
        <Animated.View style={{ transform: [{ translateY: iconLift }, { scale: iconScale }] }}>
          <Icon color={iconColor} size={22} />
        </Animated.View>
      </View>
      <Text
        numberOfLines={1}
        className={cn(
          "text-xs",
          active ? "font-semibold text-primary" : "text-muted",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
