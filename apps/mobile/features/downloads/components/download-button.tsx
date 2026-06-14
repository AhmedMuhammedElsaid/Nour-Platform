import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, View } from "react-native";

import { CheckIcon, DownloadIcon, RetryIcon } from "@/components/icons/player-icons";
import { useTheme } from "@/lib/theme-context";
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
  const { theme } = useTheme();
  const iconColor = theme === "dark" ? "#5a4a38" : "#6b7670";
  const successColor = theme === "dark" ? "#86efac" : "#22c55e";
  const dangerColor = theme === "dark" ? "#fca5a5" : "#ef4444";

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
        <CheckIcon color={successColor} size={20} />
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
        <RetryIcon color={dangerColor} size={20} />
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
      <DownloadIcon color={iconColor} size={20} />
    </Pressable>
  );
}
