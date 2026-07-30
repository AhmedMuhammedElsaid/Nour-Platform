import * as React from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { formatBytes, getTotalDownloadSize } from "@/lib/downloads";
import type { DownloadRecord } from "@/lib/downloads";
import type { UseDownloads } from "@/features/downloads/hooks/use-downloads";
import { usePlayerActions, usePlayerTransport, type QueueTrack } from "@/lib/player-context";

type Props = {
  downloads: UseDownloads;
};

type DownloadRowProps = {
  record: DownloadRecord;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  playLabel: string;
  deleteLabel: string;
  deleteText: string;
  onPlay: (index: number) => void;
  onDelete: (trackId: string) => void;
};

// Same row-scoped-comparator fix as playlist/[slug].tsx's TrackRow: this
// screen subscribes to usePlayerTransport() (currentTrack/isPlaying), which
// changes on every play/pause/track-switch ANYWHERE in the app, not just
// within Downloads — without this memo, that re-renders every row in the
// list every time. Callback identities are intentionally not compared, only
// the data that determines what the row renders.
const DownloadRow = React.memo(
  function DownloadRow({
    record,
    index,
    isActive,
    isPlaying,
    playLabel,
    deleteLabel,
    deleteText,
    onPlay,
    onDelete,
  }: DownloadRowProps) {
    return (
      <View className="flex-row items-center gap-3 border-b border-border py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playLabel}
          onPress={() => onPlay(index)}
          className="flex-1 flex-row items-center gap-3"
        >
          <Text
            variant="muted"
            className={`w-6 text-center ${isActive && isPlaying ? "text-primary font-bold" : ""}`}
          >
            {isActive && isPlaying ? "▶" : String(index + 1)}
          </Text>
          <View className="flex-1 gap-0.5">
            <Text variant="body" numberOfLines={1} className={isActive ? "text-primary font-medium" : ""}>
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
          accessibilityLabel={deleteLabel}
          onPress={() => onDelete(record.trackId)}
          className="rounded-md border border-danger px-3 py-1.5"
        >
          <Text className="text-danger text-sm">{deleteText}</Text>
        </Pressable>
      </View>
    );
  },
  (prev, next) =>
    prev.record === next.record &&
    prev.index === next.index &&
    prev.isActive === next.isActive &&
    prev.isPlaying === next.isPlaying &&
    prev.playLabel === next.playLabel &&
    prev.deleteLabel === next.deleteLabel &&
    prev.deleteText === next.deleteText,
);

export function DownloadsList({ downloads }: Props) {
  const { t } = useTranslation();
  const { records, remove } = downloads;
  const { currentTrack, isPlaying } = usePlayerTransport();
  const { loadQueue } = usePlayerActions();

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

  const onPlay = React.useCallback(
    (index: number) => loadQueue(queue, index),
    [queue, loadQueue],
  );

  if (records.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-bg px-4">
        <Text variant="muted">{t("downloads.empty")}</Text>
      </View>
    );
  }

  const deleteLabel = t("downloads.delete");

  return (
    <FlatList
      className="flex-1 bg-bg px-4"
      data={records}
      keyExtractor={(record) => record.trackId}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={
        <View className="flex-row items-center justify-between py-3">
          <Text variant="muted">
            {t("downloads.totalSize", { size: formatBytes(totalBytes) })}
          </Text>
          <View className="w-28">
            <Button label={t("downloads.playAll")} onPress={() => loadQueue(queue, 0)} />
          </View>
        </View>
      }
      renderItem={({ item, index }) => (
        <DownloadRow
          record={item}
          index={index}
          isActive={currentTrack?.id === item.trackId}
          isPlaying={isPlaying}
          playLabel={t("downloads.play", { title: item.title })}
          deleteLabel={deleteLabel}
          deleteText={deleteLabel}
          onPlay={onPlay}
          onDelete={remove}
        />
      )}
    />
  );
}
