import * as React from "react";
import {
  getDownloads,
  downloadTrack,
  deleteDownload,
  type DownloadRecord,
} from "@/lib/downloads";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DownloadStatus = "idle" | "downloading" | "complete" | "failed";

export type UseDownloads = {
  records: DownloadRecord[];
  getStatus: (trackId: string) => DownloadStatus;
  isDownloaded: (trackId: string) => boolean;
  getLocalUrl: (trackId: string) => string | null;
  startDownload: (track: {
    id: string;
    title: string;
    srcUrl: string;
    playlistTitle?: string;
    playlistSlug?: string;
  }) => void;
  remove: (trackId: string) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDownloads(): UseDownloads {
  const [records, setRecords] = React.useState<DownloadRecord[]>([]);
  const [downloading, setDownloading] = React.useState<Set<string>>(new Set());
  const [failed, setFailed] = React.useState<Set<string>>(new Set());

  // Load persisted records on mount.
  React.useEffect(() => {
    void getDownloads().then(setRecords);
  }, []);

  const refresh = React.useCallback((): void => {
    void getDownloads().then(setRecords);
  }, []);

  const getStatus = React.useCallback(
    (trackId: string): DownloadStatus => {
      if (downloading.has(trackId)) return "downloading";
      if (failed.has(trackId)) return "failed";
      if (records.some((r) => r.trackId === trackId)) return "complete";
      return "idle";
    },
    [downloading, failed, records],
  );

  const isDownloaded = React.useCallback(
    (trackId: string): boolean => records.some((r) => r.trackId === trackId),
    [records],
  );

  // Returns the local file URI from the in-memory records (no async check).
  // The player does a full async check via getLocalPath() at load time.
  const getLocalUrl = React.useCallback(
    (trackId: string): string | null =>
      records.find((r) => r.trackId === trackId)?.localPath ?? null,
    [records],
  );

  const startDownload = React.useCallback(
    (track: {
      id: string;
      title: string;
      srcUrl: string;
      playlistTitle?: string;
      playlistSlug?: string;
    }): void => {
      // Skip if already downloading or complete.
      if (downloading.has(track.id)) return;
      if (records.some((r) => r.trackId === track.id)) return;

      setDownloading((prev) => new Set(prev).add(track.id));
      setFailed((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });

      void downloadTrack(track)
        .then(() => {
          setDownloading((prev) => {
            const next = new Set(prev);
            next.delete(track.id);
            return next;
          });
          refresh();
        })
        .catch(() => {
          setDownloading((prev) => {
            const next = new Set(prev);
            next.delete(track.id);
            return next;
          });
          setFailed((prev) => new Set(prev).add(track.id));
        });
    },
    [downloading, records, refresh],
  );

  const remove = React.useCallback(
    (trackId: string): void => {
      void deleteDownload(trackId).then(() => {
        setFailed((prev) => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
        refresh();
      });
    },
    [refresh],
  );

  return {
    records,
    getStatus,
    isDownloaded,
    getLocalUrl,
    startDownload,
    remove,
  };
}
