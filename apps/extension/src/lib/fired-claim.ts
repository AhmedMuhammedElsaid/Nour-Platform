// Cross-context "fire once" claim for scheduled events — port of the web's
// fired-event-store.ts from localStorage to chrome.storage.local so it survives
// service-worker restarts and works even with no open tab.

// Per-worker-session identity; resets on each SW restart (intentional — a
// restarted worker should be able to claim a new event for the same prayer).
const CONTEXT_ID = Math.random().toString(36).slice(2);

// Write then read-back after this delay; lets concurrent contexts resolve to one
// winner (last-writer-wins — same approach as the web localStorage port).
const SETTLE_MS = 120;

type FiredRecord = { iso: string; owner: string };

async function readRecord(storageKey: string): Promise<FiredRecord | null> {
  try {
    const result = await chrome.storage.local.get(storageKey);
    const raw = result[storageKey] as Partial<FiredRecord> | undefined;
    if (!raw || typeof raw.iso !== "string" || typeof raw.owner !== "string") return null;
    return { iso: raw.iso, owner: raw.owner };
  } catch {
    return null;
  }
}

// True ⇢ this context owns the event and may play/notify;
// false ⇢ another context already claimed it.
// Fails open (returns true) when storage is unavailable.
export async function claimFiredEvent(
  storageKey: string,
  iso: string,
): Promise<boolean> {
  try {
    const existing = await readRecord(storageKey);
    if (existing?.iso === iso) return false;
    await chrome.storage.local.set({ [storageKey]: { iso, owner: CONTEXT_ID } });
  } catch {
    return true;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_MS));
  const after = await readRecord(storageKey);
  if (!after) return true;
  return after.iso === iso && after.owner === CONTEXT_ID;
}

export const ADHAN_FIRED_KEY = "nour.prayer.adhan.fired";
export const AZKAR_REMINDER_FIRED_KEY = "nour.azkar.reminder.fired";
