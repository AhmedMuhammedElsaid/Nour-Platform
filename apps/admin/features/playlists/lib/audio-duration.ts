/*
 * Reads audio duration (seconds) in the browser via a detached
 * HTMLAudioElement. Duration is a best-effort enrichment: both helpers
 * resolve `undefined` when the browser can't decode the source, never reject,
 * so callers can treat a missing duration as "leave it unset".
 *
 * Reading `.duration` only needs metadata to load — it does NOT require CORS
 * (that's only for canvas / Web Audio sampling), so this works on R2 public
 * URLs and on local File object URLs alike.
 */

export function durationFromSrc(src: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      resolve(Number.isFinite(d) && d > 0 ? d : undefined);
    };
    audio.onerror = () => resolve(undefined);
    audio.src = src;
  });
}

export async function durationFromFile(
  file: File,
): Promise<number | undefined> {
  const url = URL.createObjectURL(file);
  try {
    return await durationFromSrc(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
