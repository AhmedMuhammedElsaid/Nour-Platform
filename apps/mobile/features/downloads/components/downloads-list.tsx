import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import { formatBytes, getTotalDownloadSize } from "@/lib/downloads";
import type { UseDownloads } from "@/features/downloads/hooks/use-downloads";

type Props = {
  downloads: UseDownloads;
};

export function DownloadsList({ downloads }: Props) {
  const { t } = useTranslation();
  const { records, remove } = downloads;

  const [totalBytes, setTotalBytes] = React.useState(0);

  React.useEffect(() => {
    void getTotalDownloadSize().then(setTotalBytes);
  }, [records]);

  if (records.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text variant="muted">{t("downloads.empty")}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-bg px-4">
      <View className="py-3">
        <Text variant="muted">
          {t("downloads.totalSize", { size: formatBytes(totalBytes) })}
        </Text>
      </View>

      {records.map((record) => (
        <View
          key={record.trackId}
          className="flex-row items-center gap-3 border-b border-border py-3"
        >
          <View className="flex-1 gap-0.5">
            <Text variant="body" numberOfLines={1}>
              {record.title}
            </Text>
            {record.playlistTitle != null && (
              <Text variant="muted" numberOfLines={1} className="text-xs">
                {record.playlistTitle}
              </Text>
            )}
            <Text variant="muted" className="text-xs">
              {formatBytes(record.sizeBytes)}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("downloads.delete")}
            onPress={() => remove(record.trackId)}
            className="rounded-md border border-danger px-3 py-1.5"
          >
            <Text className="text-danger text-sm">{t("downloads.delete")}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
