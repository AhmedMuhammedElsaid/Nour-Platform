import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { DownloadStatus } from "@/features/downloads/hooks/use-downloads";

type Props = {
  trackId: string;
  title: string;
  status: DownloadStatus;
  onDownload: () => void;
  onDelete: () => void;
};

export function DownloadButton({ trackId: _trackId, title, status, onDownload, onDelete }: Props) {
  const { t } = useTranslation();

  if (status === "downloading") {
    return (
      <View
        accessibilityLabel={t("downloads.downloading_sr", { title })}
        accessibilityRole="progressbar"
        className="px-2"
      >
        <ActivityIndicator size="small" color="#c8a050" />
      </View>
    );
  }

  if (status === "complete") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("downloads.delete")}
        onPress={onDelete}
        className="px-2"
      >
        <Text className="text-success text-base">✓</Text>
      </Pressable>
    );
  }

  if (status === "failed") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("downloads.retry")}
        onPress={onDownload}
        className="px-2"
      >
        <Text className="text-danger text-base">↻</Text>
      </Pressable>
    );
  }

  // idle
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("downloads.download_sr", { title })}
      onPress={onDownload}
      className="px-2"
    >
      <Text className="text-muted text-base">⬇</Text>
    </Pressable>
  );
}
