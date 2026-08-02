import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { QuranEdition, QuranReciter } from "@repo/shared-core/schemas/quran";
import { BISMILLAH_UTHMANI } from "@repo/shared-core/quran/basmala";

import { CloseIcon } from "@/components/icons/player-icons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { QuranPrefs } from "@/lib/device-local";
import { useTheme } from "@/lib/theme-context";

const FONT_MIN = 0.8;
// Raised 1.6 → 3.0 on owner request: in Mushaf mode the base size is now
// auto-fitted to fill the page, so fontScale is a multiplier on an
// already-page-sized value rather than on a fixed 24dp — 1.6x was a much
// smaller ceiling in practice than it used to be. Past the fit the page simply
// scrolls, which is the documented trade-off for going bigger.
const FONT_MAX = 3.0;
const FONT_STEP = 0.1;

// Purely presentational base for the live preview's Arabic size — NOT the
// same number the reader's own auto-fit (fitMushafFontSize) would pick, which
// depends on the current page's measured area and glyph volume, neither of
// which this sheet has access to. The preview only needs to demonstrate
// RELATIVE scaling as fontScale moves; it was never meant to predict the
// reader's exact on-page size.
const PREVIEW_BASE_SIZE = 20;

// SVG strokes can't read NativeWind classes (see components/icons/tab-icons.tsx).
const TEXT_2_HEX = { dark: "#8a7a62", light: "#3f4a44" } as const;

export interface ReaderSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  prefs: QuranPrefs;
  onChange: (next: QuranPrefs) => void;
  editions: QuranEdition[];
  reciters: QuranReciter[];
}

function Selectable({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        "rounded-full border px-3 py-1.5",
        selected ? "border-primary bg-surface-2" : "border-border",
      )}
    >
      <Text className={cn("text-sm", selected ? "text-primary" : "text-text-2")}>{label}</Text>
    </Pressable>
  );
}

// A labelled group — the "grouped cards" concept the owner picked (B1 from
// the design review), one card per related cluster of settings instead of one
// long undifferentiated scroll.
function SettingsCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2 rounded-lg bg-surface-2 p-3">
      <Text className="text-xs uppercase tracking-wide text-text-2">{label}</Text>
      {children}
    </View>
  );
}

// RN port of apps/web/features/quran/components/reader-settings-sheet.tsx as a
// bottom modal. Changes are staged in a local draft and only applied on Save
// (point 16) — Cancel discards them. This matters because the translation/
// reciter slugs are part of the reader's query key, so applying every keystroke
// would refetch repeatedly; staging defers the refetch to one Save. The live
// preview below reads the DRAFT, not the committed prefs, precisely so it can
// restyle as the user adjusts font size/translation without triggering that
// refetch (owner-picked, cloned from concept B3 onto the B1 card layout).
export function ReaderSettingsSheet({
  open,
  onClose,
  prefs,
  onChange,
  editions,
  reciters,
}: ReaderSettingsSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  // Draft seeded from the committed prefs each time the sheet opens.
  const [draft, setDraft] = useState<QuranPrefs>(prefs);
  useEffect(() => {
    if (open) setDraft(prefs);
  }, [open, prefs]);

  const update = (patch: Partial<QuranPrefs>) => setDraft((d) => ({ ...d, ...patch }));

  const setFont = (delta: number) => {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round((draft.fontScale + delta) * 10) / 10));
    update({ fontScale: next });
  };

  const save = () => {
    onChange(draft);
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable className="max-h-[85%] rounded-t-xl border-t border-border bg-surface" onPress={() => undefined}>
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text variant="title">{t("quran.settings")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              onPress={onClose}
              className="size-8 items-center justify-center"
            >
              <CloseIcon color={TEXT_2_HEX[theme]} size={18} />
            </Pressable>
          </View>

          {/* Live preview — B3, pinned above the controls rather than inside the
              scroll, so it stays visible while the user adjusts font size below
              it. Reads `draft`, so it restyles on every tap and reverts for free
              if the user backs out with Cancel — nothing here touches the
              committed reader until Save. */}
          <View className="items-center gap-2 border-b border-border bg-bg px-4 py-4">
            <Text
              className="text-center font-quran text-text"
              style={{ fontSize: PREVIEW_BASE_SIZE * draft.fontScale, writingDirection: "rtl" }}
            >
              {BISMILLAH_UTHMANI}
            </Text>
            {draft.showTranslation && (
              <Text variant="muted" className="text-center text-xs">
                {t("quran.settingsPreviewTranslation")}
              </Text>
            )}
          </View>

          <ScrollView className="px-4" contentContainerClassName="gap-3 py-4">
            <SettingsCard label={t("quran.display")}>
              <View className="flex-row items-center justify-between">
                <Text>{t("quran.showTranslation")}</Text>
                <Switch
                  accessibilityLabel={t("quran.showTranslation")}
                  value={draft.showTranslation}
                  onValueChange={(v) => update({ showTranslation: v })}
                />
              </View>
              <View className="flex-row items-center justify-between">
                <Text>{t("quran.wordByWord")}</Text>
                <Switch
                  accessibilityLabel={t("quran.wordByWord")}
                  value={draft.showWordByWord}
                  onValueChange={(v) => update({ showWordByWord: v })}
                />
              </View>
              <View className="flex-row items-center justify-between">
                <Text>{t("quran.fontSize")}</Text>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("quran.fontSmaller")}
                    onPress={() => setFont(-FONT_STEP)}
                    className="size-9 items-center justify-center rounded-full border border-border"
                  >
                    <Text className="text-lg">−</Text>
                  </Pressable>
                  <Text variant="muted" className="w-10 text-center tabular-nums">
                    {Math.round(draft.fontScale * 100)}%
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("quran.fontLarger")}
                    onPress={() => setFont(FONT_STEP)}
                    className="size-9 items-center justify-center rounded-full border border-border"
                  >
                    <Text className="text-lg">＋</Text>
                  </Pressable>
                </View>
              </View>
            </SettingsCard>

            <SettingsCard label={t("quran.layout")}>
              <View className="flex-row flex-wrap gap-2">
                <Selectable
                  label={t("quran.layoutList")}
                  selected={draft.layout === "list"}
                  onPress={() => update({ layout: "list" })}
                />
                <Selectable
                  label={t("quran.layoutMushaf")}
                  selected={draft.layout === "mushaf"}
                  onPress={() => update({ layout: "mushaf" })}
                />
              </View>
            </SettingsCard>

            {editions.length > 0 && (
              <SettingsCard label={t("quran.translation")}>
                <View className="flex-row flex-wrap gap-2">
                  {editions.map((ed) => (
                    <Selectable
                      key={ed.slug}
                      label={ed.name}
                      selected={draft.translationSlug === ed.slug}
                      onPress={() => update({ translationSlug: ed.slug })}
                    />
                  ))}
                </View>
              </SettingsCard>
            )}

            {reciters.length > 0 && (
              <SettingsCard label={t("quran.reciter")}>
                <View className="flex-row flex-wrap gap-2">
                  {reciters.map((r) => (
                    <Selectable
                      key={r.slug}
                      label={r.name}
                      selected={draft.reciterSlug === r.slug}
                      onPress={() => update({ reciterSlug: r.slug })}
                    />
                  ))}
                </View>
              </SettingsCard>
            )}
          </ScrollView>

          {/* Save / Cancel — staged prefs apply only on Save (point 16). Pad the
              bottom past the Android nav bar / home indicator so the buttons
              aren't hidden under the system buttons. */}
          <View
            className="flex-row gap-3 border-t border-border px-4 pt-3"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <View className="flex-1">
              <Button label={t("common.cancel")} variant="outline" onPress={onClose} />
            </View>
            <View className="flex-1">
              <Button label={t("common.save")} onPress={save} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
