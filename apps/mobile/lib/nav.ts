import { router } from "expo-router";

// Tab-root screens (Prayer Times, Adhkar, Quran, Downloads) sit on a
// presentational bottom-tab-bar (components/bottom-tab-bar.tsx), not an
// expo-router <Tabs> navigator — so there is no reliable "pop to the tab
// root" history the way a real tab navigator would give you. Popping the
// actual history is still the more predictable choice when one exists (e.g.
// Quran index -> a surah -> back should land on Quran index, not Home); only
// fall back to Home when the stack has nothing left to pop.
export function goBackOrHome(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}
