// First-launch flag. Device-local only (AsyncStorage) — no server. The gate
// (components/onboarding-gate.tsx) shows once until `complete()` is called, then
// never again. Mirrors the read-then-hydrate pattern of the prayer settings
// hooks so the gate doesn't flash on every cold start.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nour.onboarding.done";

export type OnboardingApi = {
  hydrated: boolean;
  done: boolean;
  complete: () => void;
};

export function useOnboarding(): OnboardingApi {
  const [done, setDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setDone(raw === "1"))
      .catch(() => setDone(false))
      .finally(() => setHydrated(true));
  }, []);

  const complete = useCallback(() => {
    setDone(true);
    void AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => {});
  }, []);

  return { hydrated, done, complete };
}
