import { Text } from "@/components/ui/text";

// RN port of apps/web/features/quran/components/translation-block.tsx.
// `writingDirection` mirrors the web `dir` attribute so an Arabic tafsir/
// translation renders RTL even on an EN device.
export function TranslationBlock({ text, dir }: { text: string; dir: "rtl" | "ltr" }) {
  return (
    <Text
      variant="muted"
      className="mt-2 text-base leading-relaxed"
      style={{ writingDirection: dir }}
      accessibilityLabel="translation"
    >
      {text}
    </Text>
  );
}
