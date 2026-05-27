"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/primitives/button";

import { updateTrackDurationAction } from "../actions/update-track-duration.action";
import { durationFromSrc } from "../lib/audio-duration";

export interface BackfillTrack {
  id: string;
  durationSecs?: number;
  srcUrl: string | null;
}

interface Props {
  tracks: BackfillTrack[];
}

type Phase = "idle" | "running" | "done";

/*
 * Backfills durations for tracks uploaded before client-side duration capture
 * existed. Reads each playable track's duration from its audio metadata in the
 * browser (no server-side audio probing, no extra dependency) and persists it
 * via updateTrackDurationAction. Renders nothing when every playable track
 * already has a duration.
 */
export function TrackDurationBackfill({ tracks }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);

  // A track is backfillable only if it can be played (has a media URL) and is
  // currently missing a duration.
  const missing = tracks.filter(
    (t): t is BackfillTrack & { srcUrl: string } =>
      t.srcUrl !== null && t.durationSecs == null,
  );

  const run = useCallback(async () => {
    setPhase("running");
    setDone(0);
    setFailed(0);

    for (const track of missing) {
      const durationSecs = await durationFromSrc(track.srcUrl);
      if (durationSecs == null) {
        setFailed((n) => n + 1);
        continue;
      }
      const result = await updateTrackDurationAction({
        trackId: track.id,
        durationSecs,
      });
      if ("error" in result) {
        setFailed((n) => n + 1);
      } else {
        setDone((n) => n + 1);
      }
    }

    setPhase("done");
    // Refetch the RSC so the persisted durations replace the "—" placeholders.
    router.refresh();
  }, [missing, router]);

  if (missing.length === 0) return null;

  return (
    <div className="mt-4 flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={run}
        disabled={phase === "running"}
      >
        {phase === "running"
          ? `Reading durations… (${done + failed}/${missing.length})`
          : `Backfill durations (${missing.length})`}
      </Button>
      {phase === "done" && (
        <span className="text-sm text-muted-foreground">
          {done} updated{failed > 0 ? `, ${failed} skipped` : ""}
        </span>
      )}
    </div>
  );
}
