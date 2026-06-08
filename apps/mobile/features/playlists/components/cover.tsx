import { Text, View } from "react-native";

import { getCoverEmoji, getCoverGradient } from "@/lib/cover-art";
import { cn } from "@/lib/cn";

export type CoverProps = {
  id: string;
  className?: string;
  emojiClassName?: string;
};

// Deterministic fallback cover: a solid tinted block with a centered emoji.
// (The web uses a CSS gradient; RN has no gradient primitive without an extra
// dep, so we use the gradient's top color as a solid fill — see lib/cover-art.)
export function Cover({ id, className, emojiClassName = "text-4xl" }: CoverProps) {
  const [from] = getCoverGradient(id);
  const emoji = getCoverEmoji(id);

  return (
    <View
      className={cn("items-center justify-center", className)}
      style={{ backgroundColor: from }}
    >
      <Text className={emojiClassName}>{emoji}</Text>
    </View>
  );
}
