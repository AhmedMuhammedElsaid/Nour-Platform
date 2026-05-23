"use client";

import { useCallback, useReducer, useRef, useEffect } from "react";

import { createTrackAction } from "../actions/create-track.action";

export type UploadStatus =
  | "pending"
  | "presigning"
  | "uploading"
  | "confirming"
  | "creating"
  | "done"
  | "error";

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  trackId?: string;
}

type Action =
  | { type: "ADD"; items: UploadItem[] }
  | { type: "SET_STATUS"; id: string; status: UploadStatus }
  | { type: "SET_PROGRESS"; id: string; progress: number }
  | { type: "SET_ERROR"; id: string; error: string }
  | { type: "SET_DONE"; id: string; trackId: string }
  | { type: "RESET"; id: string };

function reducer(state: UploadItem[], action: Action): UploadItem[] {
  switch (action.type) {
    case "ADD":
      return [...state, ...action.items];
    case "SET_STATUS":
      return state.map((i) =>
        i.id === action.id ? { ...i, status: action.status } : i,
      );
    case "SET_PROGRESS":
      return state.map((i) =>
        i.id === action.id ? { ...i, progress: action.progress } : i,
      );
    case "SET_ERROR":
      return state.map((i) =>
        i.id === action.id ? { ...i, status: "error", error: action.error } : i,
      );
    case "SET_DONE":
      return state.map((i) =>
        i.id === action.id
          ? { ...i, status: "done", progress: 100, trackId: action.trackId }
          : i,
      );
    case "RESET":
      return state.map((i) =>
        i.id === action.id
          ? { ...i, status: "pending", progress: 0, error: undefined }
          : i,
      );
    default:
      return state;
  }
}

// PUT the file to the presigned URL using XHR so we get upload progress events.
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

async function runUpload(
  item: UploadItem,
  playlistId: string,
  dispatch: React.Dispatch<Action>,
): Promise<void> {
  // Step 1: presign + create pending Media
  dispatch({ type: "SET_STATUS", id: item.id, status: "presigning" });
  let presignedUrl: string;
  let mediaId: string;
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: item.file.name,
        mimeType: item.file.type,
        sizeBytes: item.file.size,
      }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      dispatch({
        type: "SET_ERROR",
        id: item.id,
        error: body.message ?? "Failed to start upload.",
      });
      return;
    }
    const body = (await res.json()) as {
      presignedUrl: string;
      mediaId: string;
    };
    presignedUrl = body.presignedUrl;
    mediaId = body.mediaId;
  } catch {
    dispatch({ type: "SET_ERROR", id: item.id, error: "Network error." });
    return;
  }

  // Step 2: PUT file to R2 with progress
  dispatch({ type: "SET_STATUS", id: item.id, status: "uploading" });
  try {
    await uploadWithProgress(presignedUrl, item.file, (pct) => {
      dispatch({ type: "SET_PROGRESS", id: item.id, progress: pct });
    });
  } catch (err) {
    dispatch({
      type: "SET_ERROR",
      id: item.id,
      error: (err as Error).message ?? "Upload failed.",
    });
    return;
  }

  // Step 3: confirm Media (headObject + status flip)
  dispatch({ type: "SET_STATUS", id: item.id, status: "confirming" });
  try {
    const res = await fetch("/api/media/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      dispatch({
        type: "SET_ERROR",
        id: item.id,
        error: body.message ?? "Failed to confirm upload.",
      });
      return;
    }
  } catch {
    dispatch({ type: "SET_ERROR", id: item.id, error: "Network error." });
    return;
  }

  // Step 4: create Track record
  dispatch({ type: "SET_STATUS", id: item.id, status: "creating" });
  const result = await createTrackAction({
    filename: item.file.name,
    playlistId,
    mediaId,
  });
  if ("error" in result) {
    dispatch({ type: "SET_ERROR", id: item.id, error: result.error });
    return;
  }
  dispatch({ type: "SET_DONE", id: item.id, trackId: result.trackId });
}

export function useTrackUpload(playlistId: string) {
  const [items, dispatch] = useReducer(reducer, []);
  const itemsRef = useRef<UploadItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const addFiles = useCallback(
    (files: File[]) => {
      const newItems: UploadItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "pending" as const,
        progress: 0,
      }));
      dispatch({ type: "ADD", items: newItems });
      for (const item of newItems) {
        runUpload(item, playlistId, dispatch);
      }
    },
    [playlistId],
  );

  const retry = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item || item.status !== "error") return;
      dispatch({ type: "RESET", id });
      runUpload(
        { ...item, status: "pending", progress: 0, error: undefined },
        playlistId,
        dispatch,
      );
    },
    [playlistId],
  );

  return { items, addFiles, retry };
}
