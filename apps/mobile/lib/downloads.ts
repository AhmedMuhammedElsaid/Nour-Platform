import { Directory, File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const DOWNLOADS_KEY = "nour.downloads";

// Download directory under documentDirectory so files survive app updates.
function getDownloadsDir(): Directory {
  return new Directory(Paths.document, "nour-audio");
}

function getTrackFile(trackId: string): File {
  return new File(Paths.document, "nour-audio", `${trackId}.mp3`);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DownloadRecord = {
  trackId: string;
  title: string;
  playlistTitle?: string;
  playlistSlug?: string;
  localPath: string; // absolute file:// URI
  sizeBytes: number;
  downloadedAt: number;
};

// ---------------------------------------------------------------------------
// Metadata persistence (AsyncStorage)
// ---------------------------------------------------------------------------

async function readRecords(): Promise<DownloadRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DownloadRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeRecords(records: DownloadRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(records));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns all download records (metadata only; does not verify files exist). */
export async function getDownloads(): Promise<DownloadRecord[]> {
  return readRecords();
}

/**
 * Returns the local file:// URI for a track if it has been downloaded AND the
 * file still exists on disk. Returns null otherwise (stale record is pruned).
 */
export async function getLocalPath(trackId: string): Promise<string | null> {
  const records = await readRecords();
  const record = records.find((r) => r.trackId === trackId);
  if (!record) return null;

  const file = getTrackFile(trackId);
  if (file.exists) return file.uri;

  // Stale — file was deleted externally; prune the metadata record.
  await writeRecords(records.filter((r) => r.trackId !== trackId));
  return null;
}

/**
 * Downloads a track's audio to app-local storage.
 * Throws on network/HTTP failure; the caller should surface a "failed" state.
 */
export async function downloadTrack(track: {
  id: string;
  title: string;
  srcUrl: string;
  playlistTitle?: string;
  playlistSlug?: string;
}): Promise<DownloadRecord> {
  // Ensure the downloads directory exists.
  const dir = getDownloadsDir();
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }

  const destFile = getTrackFile(track.id);
  // idempotent:true overwrites any pre-existing (possibly partial) file.
  const downloaded = await File.downloadFileAsync(track.srcUrl, destFile, {
    idempotent: true,
  });

  const record: DownloadRecord = {
    trackId: track.id,
    title: track.title,
    playlistTitle: track.playlistTitle,
    playlistSlug: track.playlistSlug,
    localPath: downloaded.uri,
    sizeBytes: downloaded.size,
    downloadedAt: Date.now(),
  };

  const records = await readRecords();
  const without = records.filter((r) => r.trackId !== track.id);
  await writeRecords([...without, record]);

  return record;
}

/** Deletes a downloaded file and its metadata record. */
export async function deleteDownload(trackId: string): Promise<void> {
  const file = getTrackFile(trackId);
  if (file.exists) {
    try {
      file.delete();
    } catch {
      /* file may already be gone */
    }
  }

  const records = await readRecords();
  await writeRecords(records.filter((r) => r.trackId !== trackId));
}

/** Sum of all downloaded file sizes in bytes. */
export async function getTotalDownloadSize(): Promise<number> {
  const records = await readRecords();
  return records.reduce((sum, r) => sum + r.sizeBytes, 0);
}

/** Human-readable size string (KB / MB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
