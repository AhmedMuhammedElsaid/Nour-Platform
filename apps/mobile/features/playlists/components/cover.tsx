import { Image, Text, View } from "react-native";

import { assetUrl } from "@/lib/api";
import { getCoverEmoji, getCoverGradient } from "@/lib/cover-art";
import { cn } from "@/lib/cn";

export type CoverProps = {
  id: string;
  // Owner/scholar photo (e.g. playlist.scholarImage = "/muhmd-bakr.png", an
  // origin-relative static file). When present it replaces the emoji/gradient
  // fallback (web parity, point 8).
  imageUrl?: string | null;
  className?: string;
  emojiClassName?: string;
};

// Deterministic fallback cover: a solid tinted block with a centered emoji.
// (The web uses a CSS gradient; RN has no gradient primitive without an extra
// dep, so we use the gradient's top color as a solid fill — see lib/cover-art.)
export function Cover({ id, imageUrl, className, emojiClassName = "text-4xl" }: CoverProps) {
  if (imageUrl) {
    return <Image source={{ uri: assetUrl(imageUrl) }} className={className} resizeMode="cover" />;
  }

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
