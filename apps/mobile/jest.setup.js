// The app now defaults to Arabic (lib/i18n: initialLocale = DEFAULT_LOCALE).
// Existing tests were written against the previous English default (both UI
// strings via t() and content via initialLocale). Pin the TEST environment to
// English so those assertions stay valid; the Arabic-default behaviour itself is
// a one-line value in lib/i18n. Override `initialLocale` (content locale) and
// switch the shared i18n instance (UI strings) to "en".
jest.mock("@/lib/i18n", () => {
  const actual = jest.requireActual("@/lib/i18n");
  // Keep __esModule + the real i18n instance as `default` so `import i18n from
  // "@/lib/i18n"` still resolves to the instance (with changeLanguage); only the
  // `initialLocale` content-locale value is overridden to "en".
  return { __esModule: true, ...actual, default: actual.default, initialLocale: "en" };
});
require("@/lib/i18n").default.changeLanguage("en");

// react-native-safe-area-context has no native module under Jest — return
// zero insets so lib/use-dock-spacing.ts and similar hooks work without a
// <SafeAreaProvider> in the test tree.
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  const zeroInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: View,
    useSafeAreaInsets: () => zeroInsets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 320, height: 640 }),
  };
});

// react-native-reanimated has no worklet runtime under Jest — provide a
// deterministic mock (animations resolve to their target value synchronously,
// Animated.View is a plain View). Tests assert behaviour via timers, not motion.
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c) => c },
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    withTiming: (to) => to,
    withSpring: (to) => to,
    withDelay: (_d, anim) => anim,
    withSequence: (...a) => a[a.length - 1],
    withRepeat: (anim) => anim,
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
    Easing: new Proxy({}, { get: () => () => 0 }),
  };
});

// expo-updates has no native module under Jest. reloadAsync rejects (as it does
// in dev builds) so LocaleSwitcher exercises its live-swap fallback path.
jest.mock("expo-updates", () => ({
  isEnabled: false,
  reloadAsync: jest.fn().mockRejectedValue(new Error("not supported in dev")),
}));

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

// expo-intent-launcher has no native module under Jest (battery-optimization.ts).
jest.mock("expo-intent-launcher", () => ({
  startActivityAsync: jest.fn().mockResolvedValue({ resultCode: 0 }),
  ActivityAction: {
    IGNORE_BATTERY_OPTIMIZATION_SETTINGS:
      "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
  },
}));

// expo-location mock.
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 30.0444, longitude: 31.2357 } }),
  // Compass heading provider (Qibla). No-op subscription so focus setup/teardown is safe.
  watchHeadingAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy: { Balanced: 3 },
}));

// expo-sensors mock — no native magnetometer under Jest. Available by default,
// with a no-op listener subscription so useFocusEffect setup/teardown is safe.
jest.mock("expo-sensors", () => ({
  Magnetometer: {
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted", granted: true }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted", granted: true }),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    removeAllListeners: jest.fn(),
  },
  // DeviceMotion is the tilt-compensated primary in use-magnetometer-heading;
  // available by default with a no-op listener so focus setup/teardown is safe.
  DeviceMotion: {
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    removeAllListeners: jest.fn(),
  },
}));

// expo-notifications mock.
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: "undetermined" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  scheduleNotificationAsync: jest.fn().mockResolvedValue("notif-id"),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
}));

// expo-quick-actions mock (launcher shortcuts) — factory mocks so jest never
// loads the real native module.
jest.mock("expo-quick-actions", () => ({
  setItems: jest.fn().mockResolvedValue(undefined),
  initial: undefined,
}));
jest.mock("expo-quick-actions/router", () => ({
  useQuickActionRouting: jest.fn(),
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
    // Imperative one-shot player (foreground adhan). Fresh object per call with
    // a no-op listener subscription.
    createAudioPlayer: jest.fn(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      replace: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
      volume: 1,
    })),
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
  const AppKilledPlaybackBehavior = {
    ContinuePlayback: "continue-playback",
    PausePlayback: "pause-playback",
    StopPlaybackAndRemoveNotification: "stop-playback-and-remove-notification",
  };

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
      // Default to "cold start, nothing playing" so existing suites are
      // unaffected; the session test overrides these per-case.
      getActiveTrackIndex: jest.fn().mockResolvedValue(undefined),
      getQueue: jest.fn().mockResolvedValue([]),
      getPlaybackState: jest.fn().mockResolvedValue({ state: State.None }),
      skipToNext: jest.fn().mockResolvedValue(undefined),
      skipToPrevious: jest.fn().mockResolvedValue(undefined),
      registerPlaybackService: jest.fn(),
      addEventListener: jest.fn(),
    },
    State,
    Event,
    Capability,
    RepeatMode,
    AppKilledPlaybackBehavior,
    usePlaybackState: jest.fn().mockReturnValue({ state: State.None }),
    useProgress: jest.fn().mockReturnValue({ position: 0, duration: 0, buffered: 0 }),
    useActiveTrack: jest.fn().mockReturnValue(null),
    useTrackPlayerEvents: jest.fn(),
  };
});
