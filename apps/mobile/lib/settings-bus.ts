// A process-local pub/sub so the several independent settings-hook instances
// (prayer location/prefs, adhan, azkar) stay in sync after a write. Each hook
// persists to AsyncStorage and `emitSettingsChanged()`; every mounted instance
// re-reads on the event. Without this, a write from the onboarding gate or the
// prayer-times screen wouldn't reach the root <AzanScheduler> until app restart,
// so the azan would never (re)schedule. No deps — just a Set of callbacks.

type Listener = () => void;

const listeners = new Set<Listener>();

export function emitSettingsChanged(): void {
  for (const listener of listeners) listener();
}

export function onSettingsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
