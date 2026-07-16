import type { QueueTrack } from "@repo/ui/blocks/player-context";

type SurahReaderResponse = {
  ayahs: { ayahInSurah: number; audioUrl: string | null }[];
};

// Al-Fatiha (surah 1) as a playable queue in a given reciter's voice — used by
// the home Readers shelf so tapping a reciter plays Al-Fatiha in the
// background (via the shared player) while /quran stays open to pick anything
// else. Hits the same public /api/v1 route mobile/extension consume.
export async function fetchAlFatihaQueue(reciterSlug: string): Promise<QueueTrack[]> {
  const res = await fetch(`/api/v1/quran/surah/1?reciter=${encodeURIComponent(reciterSlug)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as SurahReaderResponse;
  return data.ayahs
    .filter((a): a is { ayahInSurah: number; audioUrl: string } => a.audioUrl != null)
    .map((a) => ({
      id: `quran:1:${a.ayahInSurah}`,
      title: `Al-Fatiha · ${a.ayahInSurah}`,
      mediaUrl: a.audioUrl,
    }));
}
