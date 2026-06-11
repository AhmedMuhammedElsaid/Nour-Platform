// Cross-tab / cross-closure "fire once" claim for scheduled events (adhan,
// azkar reminders). The schedulers used to dedup with a variable inside the
// effect closure, which resets on every settings/location identity change,
// locale-layout remount, and is invisible to the service-worker notification
// path and to a second tab or installed-PWA window — so the same prayer could
// play twice. localStorage is shared by all of those, so an event instant can
// be claimed exactly once per device.

const TAB_ID = Math.random().toString(36).slice(2);

// Settle window before confirming a claim: two tabs whose timers fire on the
// same prayer second both write their claim; reading back after this delay
// lets the last writer win and the other tab back off.
const SETTLE_MS = 120;

type FiredRecord = { iso: string; owner: string };

function readRecord(storageKey: string): FiredRecord | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FiredRecord> | null;
    if (typeof parsed?.iso !== "string" || typeof parsed?.owner !== "string") {
      return null;
    }
    return { iso: parsed.iso, owner: parsed.owner };
  } catch {
    return null;
  }
}

// True ⇢ this caller owns the event and may play/notify; false ⇢ some other
// path or tab already claimed it. When storage is unavailable the claim is
// granted — callers keep their in-closure dedup as the fallback.
export async function claimFiredEvent(
  storageKey: string,
  iso: string,
): Promise<boolean> {
  try {
    const existing = readRecord(storageKey);
    if (existing?.iso === iso) return false;
    localStorage.setItem(storageKey, JSON.stringify({ iso, owner: TAB_ID }));
  } catch {
    return true;
  }
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  const after = readRecord(storageKey);
  if (!after) return true;
  // A different event claimed meanwhile means ours is stale; the same event
  // under another owner means a racing tab out-wrote us.
  return after.iso === iso && after.owner === TAB_ID;
}

export const ADHAN_FIRED_KEY = "nour.prayer.adhan.fired";
export const AZKAR_REMINDER_FIRED_KEY = "nour.azkar.reminder.fired";
