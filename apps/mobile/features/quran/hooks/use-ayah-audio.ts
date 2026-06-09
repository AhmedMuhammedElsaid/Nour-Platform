import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";

// RN port of apps/web/features/quran/hooks/use-ayah-audio.ts. A single reciter
// audio stream, independent of the global RNTP playlist player: it plays one
// ayah's MP3 (everyayah.com), auto-advances to the next ayah on finish, and
// supports a repeat-ayah toggle. The currently-playing ayah is surfaced via
// `currentGlobal` so the reader can highlight + scroll to it.

export interface PlayableAyah {
  numberGlobal: number;
  audioUrl: string | null;
}

export interface UseAyahAudio {
  currentGlobal: number | null;
  isPlaying: boolean;
  repeatAyah: boolean;
  setRepeatAyah: (v: boolean) => void;
  playAyah: (numberGlobal: number) => void;
  toggle: () => void;
  stop: () => void;
}

export function useAyahAudio(ayahs: PlayableAyah[]): UseAyahAudio {
  // No initial source — we load each ayah on demand via player.replace().
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [currentGlobal, setCurrentGlobal] = useState<number | null>(null);
  const [repeatAyah, setRepeatAyah] = useState(false);

  // Allow playback even when the device ringer is on silent (the standard
  // expectation for a Quran recitation app).
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
      // Non-fatal — audio still plays, just respects the silent switch.
    });
  }, []);

  const indexByGlobal = useMemo(
    () => new Map(ayahs.map((a, i) => [a.numberGlobal, i])),
    [ayahs],
  );

  const playAt = useCallback(
    (index: number) => {
      const ayah = ayahs[index];
      if (!ayah?.audioUrl) {
        setCurrentGlobal(null);
        return;
      }
      player.replace({ uri: ayah.audioUrl });
      player.play();
      setCurrentGlobal(ayah.numberGlobal);
    },
    [ayahs, player],
  );

  const playAyah = useCallback(
    (numberGlobal: number) => {
      const idx = indexByGlobal.get(numberGlobal);
      if (idx === undefined) return;
      playAt(idx);
    },
    [indexByGlobal, playAt],
  );

  const stop = useCallback(() => {
    player.pause();
    setCurrentGlobal(null);
  }, [player]);

  const toggle = useCallback(() => {
    if (currentGlobal === null) return;
    if (status.playing) player.pause();
    else player.play();
  }, [player, status.playing, currentGlobal]);

  // Auto-advance / repeat when the current ayah finishes. `didJustFinish`
  // stays true across status updates until the next source loads, so guard
  // re-entry with a ref that clears once it goes false again.
  const handledFinishRef = useRef(false);
  useEffect(() => {
    if (!status.didJustFinish) {
      handledFinishRef.current = false;
      return;
    }
    if (handledFinishRef.current || currentGlobal === null) return;
    handledFinishRef.current = true;

    if (repeatAyah) {
      playAyah(currentGlobal);
      return;
    }
    const idx = indexByGlobal.get(currentGlobal);
    if (idx === undefined) return;
    const nextIdx = idx + 1;
    if (nextIdx >= ayahs.length) {
      setCurrentGlobal(null);
      return;
    }
    playAt(nextIdx);
  }, [
    status.didJustFinish,
    currentGlobal,
    repeatAyah,
    indexByGlobal,
    ayahs.length,
    playAyah,
    playAt,
  ]);

  return {
    currentGlobal,
    isPlaying: status.playing && currentGlobal !== null,
    repeatAyah,
    setRepeatAyah,
    playAyah,
    toggle,
    stop,
  };
}
