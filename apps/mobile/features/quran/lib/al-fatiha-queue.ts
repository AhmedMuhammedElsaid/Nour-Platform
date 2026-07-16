import { getJson } from "@/lib/api";
import type { QueueTrack } from "@/lib/player-context";

type SurahReaderResponse = {
  ayahs: { ayahInSurah: number; audioUrl: string | null }[];
};

// Al-Fatiha (surah 1) as a playable queue in a given reciter's voice — used by
// the home Readers shelf so tapping a reciter plays Al-Fatiha in the
// background (via the shared player) while /quran stays open to pick anything
// else. Mirrors apps/web/features/quran/lib/al-fatiha-queue.ts.
export async function fetchAlFatihaQueue(reciterSlug: string): Promise<QueueTrack[]> {
  const data = await getJson<SurahReaderResponse>("/quran/surah/1", { reciter: reciterSlug });
  return data.ayahs
    .filter((a): a is { ayahInSurah: number; audioUrl: string } => a.audioUrl != null)
    .map((a) => ({
      id: `quran:1:${a.ayahInSurah}`,
      title: `Al-Fatiha · ${a.ayahInSurah}`,
      mediaUrl: a.audioUrl,
    }));
}
