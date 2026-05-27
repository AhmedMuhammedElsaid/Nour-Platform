"use client";

import { useCallback, useRef } from "react";

import { Button } from "@repo/ui/primitives/button";
import { Progress } from "@repo/ui/primitives/progress";

import { useTrackUpload, type UploadItem } from "../hooks/use-track-upload";

const ALLOWED_TYPES = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg"];

function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case "pending":
      return "Waiting…";
    case "presigning":
      return "Preparing…";
    case "uploading":
      return `Uploading ${item.progress}%`;
    case "confirming":
      return "Verifying…";
    case "creating":
      return "Saving track…";
    case "done":
      return "Done";
    case "error":
      return item.error ?? "Upload failed";
  }
}

interface Props {
  playlistContentId: string;
  locale: "ar" | "en";
}

export function TrackUploader({ playlistContentId, locale }: Props) {
  const { items, addFiles, retry } = useTrackUpload(playlistContentId, locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const valid = Array.from(files).filter((f) =>
        ALLOWED_TYPES.includes(f.type),
      );
      if (valid.length > 0) addFiles(valid);
    },
    [addFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      isDraggingRef.current = false;
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <section aria-label="Track upload" className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop audio files here or click to select"
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          isDraggingRef.current = true;
        }}
        onDragLeave={() => {
          isDraggingRef.current = false;
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-base">Drop audio files here</span>
        <span>or click to select (MP3, WAV, M4A, OGG)</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Upload list */}
      {items.length > 0 && (
        <ul className="space-y-3" aria-label="Upload queue">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-border bg-surface px-4 py-3"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {item.file.name}
                </span>
                <span
                  className={
                    item.status === "error"
                      ? "shrink-0 text-xs text-destructive"
                      : item.status === "done"
                        ? "shrink-0 text-xs text-success"
                        : "shrink-0 text-xs text-muted-foreground"
                  }
                >
                  {statusLabel(item)}
                </span>
              </div>

              {item.status === "uploading" && (
                <Progress value={item.progress} className="h-1.5" />
              )}

              {item.status === "error" && (
                <Button
                  variant="outline"
                  className="mt-2 h-7 px-3 text-xs"
                  onClick={() => retry(item.id)}
                >
                  Retry
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
