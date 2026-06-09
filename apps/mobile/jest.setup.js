// expo-splash-screen has no native module under Jest.
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

// expo-font has no native module under Jest.
jest.mock("expo-font", () => ({
  useFonts: jest.fn().mockReturnValue([true, null]),
  loadAsync: jest.fn().mockResolvedValue(undefined),
}));

// expo-file-system@56 uses a class-based API. Provide stable mocks so tests
// don't hit native modules.
jest.mock("expo-file-system", () => {
  const DOC_URI = "file:///test/document/";

  class MockDirectory {
    uri = DOC_URI;
    exists = false; // default: not present so create() is exercised
    constructor(...uris) {
      this.uri = uris
        .map((u) => (typeof u === "string" ? u : u?.uri ?? ""))
        .join("")
        .replace(/\/+$/, "") + "/";
    }
    create() {}
    delete() {}
  }

  class MockFile {
    uri = "";
    exists = false;
    size = 0;
    constructor(...uris) {
      this.uri = uris
        .map((u) => (typeof u === "string" ? u : u?.uri ?? ""))
        .join("")
        .replace(/\/+$/, "");
    }
    delete() {}
  }
  MockFile.downloadFileAsync = jest.fn().mockImplementation((_url, dest) => {
    const f = new MockFile(dest.uri);
    f.exists = true;
    f.size = 1024 * 512;
    return Promise.resolve(f);
  });

  return {
    Paths: {
      document: new MockDirectory(DOC_URI),
    },
    Directory: MockDirectory,
    File: MockFile,
  };
});

// AsyncStorage has no native module under Jest — swap in the official mock.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// expo-location mock.
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 30.0444, longitude: 31.2357 } }),
  Accuracy: { Balanced: 3 },
}));

// expo-notifications mock.
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: "undetermined" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  scheduleNotificationAsync: jest.fn().mockResolvedValue("notif-id"),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

// expo-audio (Quran reciter playback) — stable player object so the reader's
// useCallback deps don't churn under test.
jest.mock("expo-audio", () => {
  const player = {
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    seekTo: jest.fn(),
    remove: jest.fn(),
  };
  return {
    useAudioPlayer: () => player,
    useAudioPlayerStatus: () => ({
      playing: false,
      didJustFinish: false,
      isLoaded: false,
      currentTime: 0,
      duration: 0,
    }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  };
});

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
