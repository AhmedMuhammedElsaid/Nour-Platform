"use client";

import { useState, useTransition } from "react";

import { Button } from "@repo/ui/primitives/button";

import { togglePublishAction } from "../actions/toggle-publish.action";

interface Props {
  playlistId: string;
  initialStatus: "draft" | "published";
}

export function PublishToggle({ playlistId, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      setError(null);
      const result = await togglePublishAction(playlistId, status);
      if ("error" in result) {
        setError(result.error);
      } else {
        setStatus(result.status);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <span
        className={
          status === "published"
            ? "text-sm font-medium text-success"
            : "text-sm font-medium text-muted-foreground"
        }
        aria-live="polite"
      >
        {status === "published" ? "Published" : "Draft"}
      </span>
      <Button
        variant={status === "published" ? "outline" : "default"}
        size="sm"
        disabled={isPending}
        onClick={handleToggle}
        aria-label={
          status === "published" ? "Unpublish playlist" : "Publish playlist"
        }
      >
        {isPending
          ? "Saving…"
          : status === "published"
            ? "Unpublish"
            : "Publish"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
