// SoundCloud-style bottom tab bar. Presentational nav rendered in the root
// layout (see components/bottom-dock.tsx) rather than an expo-router <Tabs>
// navigator — this avoids restructuring every route into a (tabs) group and
// keeps the existing nested Quran/Adhkar/Playlist stacks + deep links intact.
// Active tab is derived from usePathname(); switching uses router.navigate()
// so revisiting an already-open destination pops back to it (state preserved)
// instead of pushing an ever-growing stack.

import { memo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
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

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// `pathname` is a PROP, not a `usePathname()` call: the dock (bottom-dock.tsx)
// already subscribes to it, so subscribing again here re-rendered this tree
// twice per navigation. memo + the stable `onSelect`/`TabDef` props below mean
// only the two tabs whose `active` actually flipped re-render.
function BottomTabBarImpl({
  pathname,
  bottomInset = 0,
}: {
  pathname: string;
  bottomInset?: number;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();

  // Read the live pathname through a ref so this callback keeps a `[]` dep list.
  // With `[pathname]` it changed identity on every navigation, which invalidated
  // the `onSelect` prop on all five memoized <TabItem>s and re-rendered the whole
  // row — the memo only ever saved the icon subtree.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const select = useCallback(
    (href: TabDef["href"]) => {
      if (!isActive(pathnameRef.current, href)) router.navigate(href);
    },
    [router],
  );

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
            href={tab.href}
            label={t(tab.labelKey)}
            active={active}
            Icon={tab.Icon}
            iconColor={active ? activeColor : inactiveColor}
            onSelect={select}
          />
        );
      })}
    </View>
  );
}

export const BottomTabBar = memo(BottomTabBarImpl);

const TabItem = memo(function TabItem({
  href,
  label,
  active,
  Icon,
  iconColor,
  onSelect,
}: {
  href: TabDef["href"];
  label: string;
  active: boolean;
  Icon: TabIcon;
  iconColor: string;
  onSelect: (href: TabDef["href"]) => void;
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
      onPress={() => onSelect(href)}
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
});
