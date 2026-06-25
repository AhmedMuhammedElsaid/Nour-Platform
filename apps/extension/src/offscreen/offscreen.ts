import { type FromOffscreen, isToOffscreen } from "./protocol";

// One reusable <audio> element. An offscreen document created for AUDIO_PLAYBACK
// is exempt from the autoplay gesture requirement, so play() works with no tab
// open and no prior user interaction.
const audio = new Audio();

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isToOffscreen(message)) return;
  if (message.type === "play") {
    audio.src = message.url;
    audio.volume = Math.min(1, Math.max(0, message.volume));
    audio.currentTime = 0;
    void audio.play().catch((err: unknown) => {
      console.error("[nour offscreen] adhan play failed", err);
      // Report completion so the worker still tears the document down.
      notifyEnded();
    });
  } else {
    audio.pause();
  }
});

// On natural end, tell the worker so it can close this document (offscreen docs
// should not linger idle). Phase 3 audio-while-browsing will keep it open.
audio.addEventListener("ended", notifyEnded);

function notifyEnded(): void {
  const msg: FromOffscreen = { target: "background", type: "audio-ended" };
  void chrome.runtime.sendMessage(msg).catch(() => {
    // Worker may already be gone; the document gets cleaned up regardless.
  });
}
