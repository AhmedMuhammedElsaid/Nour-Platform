// AsyncStorage has no native module under Jest — swap in the official mock.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// react-native-track-player has no JS-only fallback — provide a complete mock.
jest.mock("react-native-track-player", () => {
  const State = { None: "none", Playing: "playing", Paused: "paused", Buffering: "buffering", Loading: "loading" };
  const Event = {
    RemotePlay: "remote-play",
    RemotePause: "remote-pause",
    RemoteStop: "remote-stop",
    RemoteNext: "remote-next",
    RemotePrevious: "remote-previous",
    RemoteSeek: "remote-seek",
    RemoteJumpForward: "remote-jump-forward",
    RemoteJumpBackward: "remote-jump-backward",
    PlaybackQueueEnded: "playback-queue-ended",
    PlaybackError: "playback-error",
    PlaybackState: "playback-state",
    PlaybackProgressUpdated: "playback-progress-updated",
  };
  const Capability = {
    Play: "play",
    Pause: "pause",
    Stop: "stop",
    SkipToNext: "skip-to-next",
    SkipToPrevious: "skip-to-previous",
    SeekTo: "seek-to",
    JumpForward: "jump-forward",
    JumpBackward: "jump-backward",
  };
  const RepeatMode = { Off: 0, Track: 1, Queue: 2 };

  return {
    __esModule: true,
    default: {
      setupPlayer: jest.fn().mockResolvedValue(undefined),
      updateOptions: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      seekTo: jest.fn().mockResolvedValue(undefined),
      setRate: jest.fn().mockResolvedValue(undefined),
      setVolume: jest.fn().mockResolvedValue(undefined),
      setRepeatMode: jest.fn().mockResolvedValue(undefined),
      getProgress: jest.fn().mockResolvedValue({ position: 0, duration: 0, buffered: 0 }),
      skipToNext: jest.fn().mockResolvedValue(undefined),
      skipToPrevious: jest.fn().mockResolvedValue(undefined),
      registerPlaybackService: jest.fn(),
      addEventListener: jest.fn(),
    },
    State,
    Event,
    Capability,
    RepeatMode,
    usePlaybackState: jest.fn().mockReturnValue({ state: State.None }),
    useProgress: jest.fn().mockReturnValue({ position: 0, duration: 0, buffered: 0 }),
    useActiveTrack: jest.fn().mockReturnValue(null),
    useTrackPlayerEvents: jest.fn(),
  };
});
