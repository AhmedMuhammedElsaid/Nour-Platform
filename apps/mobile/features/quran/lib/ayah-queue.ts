import { assetUrl } from "@/lib/api";
import type { QueueTrack } from "@/lib/player-context";
import type {
  QuranReciter,
  ReaderAyah,
  SurahReader,
} from "@repo/shared-core/schemas/quran";

// Namespaced track id so the Reader can tell an ayah track apart from a playlist
// track and map it back to the ayah's global number (for highlight + scroll).
export const AYAH_TRACK_PREFIX = "quran:";

export function ayahTrackId(numberGlobal: number): string {
  return `${AYAH_TRACK_PREFIX}${numberGlobal}`;
}

export function parseAyahTrackId(id: string | null | undefined): number | null {
  if (!id || !id.startsWith(AYAH_TRACK_PREFIX)) return null;
  const n = Number(id.slice(AYAH_TRACK_PREFIX.length));
  return Number.isInteger(n) ? n : null;
}

// Build a per-ayah RNTP queue for a surah in the resolved reciter's voice. Ayahs
// with no audio (no reciter resolved for that ayah) are skipped, so the queue
// index is NOT the same as the data.ayahs index — callers must locate a track by
// id, not by position.
export function buildAyahQueue(
  surah: SurahReader["surah"],
  ayahs: ReaderAyah[],
  reciter: QuranReciter | null,
  locale: string,
): QueueTrack[] {
  const surahName = locale === "ar" ? surah.name.ar : surah.name.en;
  const artist = reciter
    ? locale === "ar"
      ? (reciter.arabicName ?? reciter.name)
      : reciter.name
    : "";
  const cover = reciter?.image ? assetUrl(reciter.image) : undefined;

  const tracks: QueueTrack[] = [];
  for (const a of ayahs) {
    if (!a.audioUrl) continue;
    tracks.push({
      id: ayahTrackId(a.numberGlobal),
      title: `${surahName} · ${a.ayahInSurah}`,
      mediaUrl: a.audioUrl,
      playlistTitle: artist,
      coverUrl: cover,
    });
  }
  return tracks;
}
