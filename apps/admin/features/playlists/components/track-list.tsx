"use client";

import { useState, useCallback } from "react";

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { reorderTracksAction } from "../actions/reorder-tracks.action";

export interface SerializedTrack {
  id: string;
  title: string;
  order: number;
  durationSecs?: number;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SortableTrack({ track }: { track: SerializedTrack }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3"
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${track.title}`}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="flex-1 truncate text-sm">{track.title}</span>
      {track.durationSecs != null && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDuration(track.durationSecs)}
        </span>
      )}
    </li>
  );
}

interface Props {
  playlistContentId: string;
  locale: "ar" | "en";
  initialTracks: SerializedTrack[];
}

export function TrackList({ playlistContentId, locale, initialTracks }: Props) {
  const [tracks, setTracks] = useState(initialTracks);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const snapshot = tracks;
      const oldIndex = tracks.findIndex((t) => t.id === active.id);
      const newIndex = tracks.findIndex((t) => t.id === over.id);
      const reordered = arrayMove(tracks, oldIndex, newIndex);

      setTracks(reordered);
      setError(null);

      const result = await reorderTracksAction(
        locale,
        playlistContentId,
        reordered.map((t) => t.id),
      );

      if (result?.error) {
        setTracks(snapshot);
        setError(result.error);
      }
    },
    [tracks, playlistContentId, locale],
  );

  if (tracks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tracks yet. Upload audio files below.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tracks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2" aria-label="Track list">
            {tracks.map((track) => (
              <SortableTrack key={track.id} track={track} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
