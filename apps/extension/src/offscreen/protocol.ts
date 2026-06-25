// Message contract between the background service worker and the offscreen audio
// document. chrome.runtime messaging broadcasts to every extension context, so
// each message carries a `target` the receiver filters on.

// Built path of the offscreen page. CRXJS keeps an input HTML file's source path
// in dist (the options page builds to dist/src/options/index.html), so this same
// string resolves via chrome.runtime.getURL for createDocument.
export const OFFSCREEN_URL = "src/offscreen/index.html";

export type ToOffscreen =
  | { target: "offscreen"; type: "play"; url: string; volume: number }
  | { target: "offscreen"; type: "stop" };

export type FromOffscreen = { target: "background"; type: "audio-ended" };

export function isFromOffscreen(msg: unknown): msg is FromOffscreen {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { target?: unknown }).target === "background" &&
    (msg as { type?: unknown }).type === "audio-ended"
  );
}

export function isToOffscreen(msg: unknown): msg is ToOffscreen {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { target?: unknown }).target === "offscreen"
  );
}
