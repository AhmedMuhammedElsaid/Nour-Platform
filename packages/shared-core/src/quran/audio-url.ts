// Mirrors the service-side derivation so the client can recompute an ayah's
// audio URL from a reciter base if needed (everyayah.com layout).
export function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

export function ayahAudioUrl(
  base: string,
  surah: number,
  ayahInSurah: number,
): string {
  return `${base}${pad3(surah)}${pad3(ayahInSurah)}.mp3`;
}
