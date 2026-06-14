import * as React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { formatBytes, getTotalDownloadSize } from "@/lib/downloads";
import type { UseDownloads } from "@/features/downloads/hooks/use-downloads";
import { usePlayer, type QueueTrack } from "@/lib/player-context";

type Props = {
  downloads: UseDownloads;
};

export function DownloadsList({ downloads }: Props) {
  const { t } = useTranslation();
  const { records, remove } = downloads;
  const { loadQueue, currentTrack, isPlaying } = usePlayer();

  const [totalBytes, setTotalBytes] = React.useState(0);

  React.useEffect(() => {
    void getTotalDownloadSize().then(setTotalBytes);
  }, [records]);

  // A queue built from the downloaded files. The player still prefers the local
  // file via getLocalPath(id) at load time, but mediaUrl carries it directly so
  // playback works fully offline (point 12).
  const queue = React.useMemo<QueueTrack[]>(
    () =>
      records.map((r) => ({
        id: r.trackId,
        title: r.title,
        mediaUrl: r.localPath,
        playlistTitle: r.playlistTitle,
        playlistSlug: r.playlistSlug,
      })),
    [records],
  );

  if (records.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text variant="muted">{t("downloads.empty")}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-bg px-4">
      <View className="flex-row items-center justify-between py-3">
        <Text variant="muted">
          {t("downloads.totalSize", { size: formatBytes(totalBytes) })}
        </Text>
        <View className="w-28">
          <Button label={t("downloads.playAll")} onPress={() => loadQueue(queue, 0)} />
        </View>
      </View>

      {records.map((record, index) => {
        const isActive = currentTrack?.id === record.trackId;
        return (
          <View
            key={record.trackId}
            className="flex-row items-center gap-3 border-b border-border py-3"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("downloads.play", { title: record.title })}
              onPress={() => loadQueue(queue, index)}
              className="flex-1 flex-row items-center gap-3"
            >
              <Text
                variant="muted"
                className={`w-6 text-center ${isActive && isPlaying ? "text-primary font-bold" : ""}`}
              >
                {isActive && isPlaying ? "▶" : String(index + 1)}
              </Text>
              <View className="flex-1 gap-0.5">
                <Text
                  variant="body"
                  numberOfLines={1}
                  className={isActive ? "text-primary font-medium" : ""}
                >
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
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("downloads.delete")}
              onPress={() => remove(record.trackId)}
              className="rounded-md border border-danger px-3 py-1.5"
            >
              <Text className="text-danger text-sm">{t("downloads.delete")}</Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}
