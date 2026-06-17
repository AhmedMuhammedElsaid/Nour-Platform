import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { QuranEdition, QuranReciter } from "@repo/shared-core/schemas/quran";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { QuranPrefs } from "@/lib/device-local";

const FONT_MIN = 0.8;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;

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

// RN port of apps/web/features/quran/components/reader-settings-sheet.tsx as a
// bottom modal. Changes are staged in a local draft and only applied on Save
// (point 16) — Cancel discards them. This matters because the translation/
// reciter slugs are part of the reader's query key, so applying every keystroke
// would refetch repeatedly; staging defers the refetch to one Save.
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
        <Pressable className="max-h-[80%] rounded-t-xl border-t border-border bg-surface" onPress={() => undefined}>
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text variant="title">{t("quran.settings")}</Text>
          </View>
          <ScrollView className="px-4" contentContainerClassName="gap-5 py-4">
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

            {editions.length > 0 ? (
              <View className="gap-2">
                <Text variant="muted">{t("quran.translation")}</Text>
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
              </View>
            ) : null}

            {reciters.length > 0 ? (
              <View className="gap-2">
                <Text variant="muted">{t("quran.reciter")}</Text>
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
              </View>
            ) : null}
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
