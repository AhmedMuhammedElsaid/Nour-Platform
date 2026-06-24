import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the boundaries so the test exercises tick()'s orchestration, not the
// pure predicates (covered by shared-core/prayer-times/schedule.test.ts) nor
// the chrome.* plumbing.
vi.mock("@repo/shared-core/prayer-times/compute", () => ({
  computePrayerTimes: vi.fn(() => ({ date: new Date(), instants: [] })),
}));
vi.mock("@repo/shared-core/prayer-times/schedule", () => ({
  recentlyMissedAdhan: vi.fn(() => null),
  nextAdhanEvent: vi.fn(() => null),
  recentlyMissedAzkarReminder: vi.fn(() => null),
  nextAzkarReminderEvent: vi.fn(() => null),
}));
vi.mock("../lib/storage", () => ({ get: vi.fn() }));
vi.mock("../lib/notify", () => ({ notifyAdhan: vi.fn(), notifyAzkar: vi.fn() }));
vi.mock("../lib/audio-router", () => ({ playAdhan: vi.fn() }));
vi.mock("../lib/fired-claim", () => ({
  ADHAN_FIRED_KEY: "nour.prayer.adhan.fired",
  AZKAR_REMINDER_FIRED_KEY: "nour.azkar.reminder.fired",
  claimFiredEvent: vi.fn(() => Promise.resolve(true)),
}));

import {
  nextAdhanEvent,
  recentlyMissedAdhan,
} from "@repo/shared-core/prayer-times/schedule";
import { playAdhan } from "../lib/audio-router";
import { claimFiredEvent } from "../lib/fired-claim";
import { notifyAdhan } from "../lib/notify";
import { get } from "../lib/storage";
import { ALARM_ADHAN, ALARM_TICK, tick } from "./scheduler";

const alarms = {
  get: vi.fn(async () => undefined),
  create: vi.fn(async () => undefined),
  clear: vi.fn(async () => true),
  clearAll: vi.fn(async () => true),
};
vi.stubGlobal("chrome", { alarms });

const ADHAN_ON = { enabled: true, perPrayer: {}, volume: 0.8 };
const ADHAN_OFF = { enabled: false, perPrayer: {}, volume: 0.8 };
const AZKAR_OFF = { enabled: false, offsetMinutes: 15 };
const LOCATION = { lat: 30, lng: 31, label: "Cairo" };
const PREFS = { method: "Egyptian", madhab: "standard" };

function mockStorage(adhan: unknown, azkar: unknown) {
  vi.mocked(get).mockImplementation((key: string) => {
    if (key === "nour.prayer.adhan") return Promise.resolve(adhan) as never;
    if (key === "nour.azkar.reminder") return Promise.resolve(azkar) as never;
    if (key === "nour.prayer.location") return Promise.resolve(LOCATION) as never;
    return Promise.resolve(PREFS) as never;
  });
}

describe("tick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alarms.get.mockResolvedValue(undefined);
    vi.mocked(claimFiredEvent).mockResolvedValue(true);
    vi.mocked(recentlyMissedAdhan).mockReturnValue(null);
    vi.mocked(nextAdhanEvent).mockReturnValue(null);
  });

  it("clears all alarms and fires nothing when adhan + azkar are both disabled", async () => {
    mockStorage(ADHAN_OFF, AZKAR_OFF);
    await tick();
    expect(alarms.clearAll).toHaveBeenCalledOnce();
    expect(notifyAdhan).not.toHaveBeenCalled();
    expect(alarms.create).not.toHaveBeenCalled();
  });

  it("fires a due adhan (notify + play) and arms the heartbeat", async () => {
    mockStorage(ADHAN_ON, AZKAR_OFF);
    const due = { key: "dhuhr" as const, time: new Date() };
    vi.mocked(recentlyMissedAdhan).mockReturnValue(due);

    await tick();

    expect(claimFiredEvent).toHaveBeenCalledWith(
      "nour.prayer.adhan.fired",
      due.time.toISOString(),
    );
    expect(notifyAdhan).toHaveBeenCalledWith("dhuhr");
    expect(playAdhan).toHaveBeenCalledWith("dhuhr", 0.8);
    // ensureTick saw no existing alarm → created the periodic heartbeat.
    expect(alarms.create).toHaveBeenCalledWith(ALARM_TICK, { periodInMinutes: 1 });
  });

  it("does not notify when the fired-claim is lost to another context", async () => {
    mockStorage(ADHAN_ON, AZKAR_OFF);
    vi.mocked(recentlyMissedAdhan).mockReturnValue({ key: "asr", time: new Date() });
    vi.mocked(claimFiredEvent).mockResolvedValue(false);

    await tick();

    expect(notifyAdhan).not.toHaveBeenCalled();
    expect(playAdhan).not.toHaveBeenCalled();
  });

  it("arms a precise adhan alarm at the next event instant", async () => {
    mockStorage(ADHAN_ON, AZKAR_OFF);
    const at = new Date(Date.now() + 3_600_000);
    vi.mocked(nextAdhanEvent).mockReturnValue({ key: "maghrib", time: at });

    await tick();

    expect(alarms.create).toHaveBeenCalledWith(ALARM_ADHAN, { when: at.getTime() });
  });

  it("clears the precise adhan alarm when no event remains today", async () => {
    mockStorage(ADHAN_ON, AZKAR_OFF);
    vi.mocked(nextAdhanEvent).mockReturnValue(null);

    await tick();

    expect(alarms.clear).toHaveBeenCalledWith(ALARM_ADHAN);
  });

  it("does not re-create the heartbeat when one already exists (phase preserved)", async () => {
    mockStorage(ADHAN_ON, AZKAR_OFF);
    alarms.get.mockResolvedValue({ name: ALARM_TICK } as never);

    await tick();

    expect(alarms.create).not.toHaveBeenCalledWith(
      ALARM_TICK,
      expect.anything(),
    );
  });
});
