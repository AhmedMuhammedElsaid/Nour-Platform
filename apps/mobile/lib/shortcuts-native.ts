// JS bridge to the native `nour-shortcuts` Expo module (Android only). It looks
// up an already-published expo-quick-actions dynamic shortcut (ids "sabah"/
// "masaa"/"kahf") by id and requests the OS "Add to Home screen?" pin dialog for
// it — a one-tap alternative to the existing long-press-and-drag flow. On iOS,
// or a build predating the native rebuild, the module is absent and every call
// safely no-ops to `false`.

import { requireOptionalNativeModule } from "expo";

type NourShortcutsNativeModule = {
  isPinSupported(): boolean;
  requestPin(id: string): Promise<boolean>;
};

const native = requireOptionalNativeModule<NourShortcutsNativeModule>("NourShortcuts");

export type PinnableShortcutId = "sabah" | "masaa" | "kahf";

export async function isPinShortcutSupported(): Promise<boolean> {
  return native?.isPinSupported() ?? false;
}

export async function requestPinShortcut(id: PinnableShortcutId): Promise<boolean> {
  return (await native?.requestPin(id)) ?? false;
}
