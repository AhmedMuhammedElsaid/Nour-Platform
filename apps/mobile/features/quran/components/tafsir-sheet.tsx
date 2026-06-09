import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { getJson } from "@/lib/api";

interface TafsirData {
  edition: { slug: string; name: string; dir: "rtl" | "ltr" };
  html: string;
}

export interface TafsirSheetProps {
  ayah: { numberGlobal: number; ref: string } | null; // ref = "surah:ayah"
  locale: string;
  onClose: () => void;
}

// RN has no dangerouslySetInnerHTML — the tafsir comes back as HTML (scripts
// already stripped server-side), so we render it as plain text. Good enough for
// v1; a rich renderer can come later without changing the data contract.
function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|br|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function TafsirSheet({ ayah, locale, onClose }: TafsirSheetProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<TafsirData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!ayah) return;
    let cancelled = false;
    setStatus("loading");
    setData(null);
    getJson<TafsirData>("/quran/tafsir", { ayah: String(ayah.numberGlobal), locale })
      .then((j) => {
        if (!cancelled) {
          setData(j);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [ayah, locale]);

  return (
    <Modal visible={ayah !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable className="max-h-[80%] rounded-t-xl border-t border-border bg-surface" onPress={() => undefined}>
          <View className="border-b border-border px-4 py-3">
            <Text variant="title">
              {t("quran.tafsir")}
              {ayah ? ` · ${ayah.ref}` : ""}
            </Text>
          </View>
          <ScrollView className="px-4" contentContainerClassName="py-4">
            {status === "loading" ? (
              <Text variant="muted">{t("quran.loading")}</Text>
            ) : status === "error" ? (
              <Text variant="muted" accessibilityLabel="tafsir-error">
                {t("quran.tafsirError")}
              </Text>
            ) : data ? (
              <Text
                className="leading-relaxed text-text"
                style={{ writingDirection: data.edition.dir }}
              >
                {htmlToText(data.html)}
              </Text>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
