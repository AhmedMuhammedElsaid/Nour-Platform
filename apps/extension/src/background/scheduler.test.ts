import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the boundaries so the test exercises tick()'s orchestration, not the
// pure predicates (covered by shared-core/prayer-times/schedule.test.ts) nor
// the chrome.* plumbing.
vi.mock("../lib/aladhan", () => ({
  resolvePrayerDay: vi.fn(async () => ({ date: new Date(), instants: [] })),
}));
vi.mock("@repo/shared-core/prayer-times/schedule", () => ({
  recentlyMissedAdhan: vi.fn(() => null),
  nextAdhanEvent: vi.fn(() => null),
  recentlyMissedAzkarReminder: vi.fn(() => null),
  nextAzkarReminderEvent: vi.fn(() => null),
  missedKahfReminder: vi.fn(() => null),
  nextKahfReminderTime: vi.fn(() => new Date(0)),
}));
vi.mock("../lib/storage", () => ({ get: vi.fn() }));
vi.mock("../lib/notify", () => ({
  notifyAdhan: vi.fn(),
  notifyAzkar: vi.fn(),
  notifyKahf: vi.fn(),
}));
vi.mock("../lib/audio-router", () => ({ playAdhan: vi.fn() }));
vi.mock("../lib/fired-claim", () => ({
  ADHAN_FIRED_KEY: "nour.prayer.adhan.fired",
  AZKAR_REMINDER_FIRED_KEY: "nour.azkar.reminder.fired",
  KAHF_FIRED_KEY: "nour.kahf.reminder.fired",
  claimFiredEvent: vi.fn(() => Promise.resolve(true)),
}));

import {
  missedKahfReminder,
  nextAdhanEvent,
  nextKahfReminderTime,
  recentlyMissedAdhan,
} from "@repo/shared-core/prayer-times/schedule";
import { resolvePrayerDay } from "../lib/aladhan";
import { playAdhan } from "../lib/audio-router";
import { claimFiredEvent } from "../lib/fired-claim";
import { notifyAdhan, notifyKahf } from "../lib/notify";
import { get } from "../lib/storage";
import { ALARM_ADHAN, ALARM_KAHF, ALARM_TICK, tick } from "./scheduler";

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
const KAHF_ON = { enabled: true };
const KAHF_OFF = { enabled: false };
const LOCATION = { lat: 30, lng: 31, label: "Cairo" };
const PREFS = { method: "Egyptian", madhab: "standard" };

function mockStorage(adhan: unknown, azkar: unknown, kahf: unknown = KAHF_OFF) {
  vi.mocked(get).mockImplementation((key: string) => {
    if (key === "nour.prayer.adhan") return Promise.resolve(adhan) as never;
    if (key === "nour.azkar.reminder") return Promise.resolve(azkar) as never;
    if (key === "nour.kahf.reminder") return Promise.resolve(kahf) as never;
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
    vi.mocked(missedKahfReminder).mockReturnValue(null);
  });

  it("clears all alarms and fires nothing when adhan + azkar + kahf are all disabled", async () => {
    mockStorage(ADHAN_OFF, AZKAR_OFF, KAHF_OFF);
    await tick();
    expect(alarms.clearAll).toHaveBeenCalledOnce();
    expect(notifyAdhan).not.toHaveBeenCalled();
    expect(alarms.create).not.toHaveBeenCalled();
  });

  it("keeps ticking and arms the kahf alarm when ONLY kahf is enabled (no clearAll starvation)", async () => {
    mockStorage(ADHAN_OFF, AZKAR_OFF, KAHF_ON);
    const at = new Date(Date.now() + 86_400_000);
    vi.mocked(nextKahfReminderTime).mockReturnValue(at);

    await tick();

    expect(alarms.clearAll).not.toHaveBeenCalled();
    expect(alarms.create).toHaveBeenCalledWith(ALARM_KAHF, { when: at.getTime() });
  });

  it("fires the kahf reminder once inside the Friday window (claim + notify)", async () => {
    mockStorage(ADHAN_OFF, AZKAR_OFF, KAHF_ON);
    const noon = new Date(2026, 0, 2, 12, 0, 0, 0);
    vi.mocked(missedKahfReminder).mockReturnValue({ time: noon });

    await tick();

    expect(claimFiredEvent).toHaveBeenCalledWith(
      "nour.kahf.reminder.fired",
      noon.toISOString(),
    );
    expect(notifyKahf).toHaveBeenCalledOnce();
  });

  it("does not notify kahf when the fired-claim is lost to another context", async () => {
    mockStorage(ADHAN_OFF, AZKAR_OFF, KAHF_ON);
    vi.mocked(missedKahfReminder).mockReturnValue({ time: new Date() });
    vi.mocked(claimFiredEvent).mockResolvedValue(false);

    await tick();

    expect(notifyKahf).not.toHaveBeenCalled();
  });

  it("clears the kahf alarm when kahf is disabled but adhan still runs", async () => {
    mockStorage(ADHAN_ON, AZKAR_OFF, KAHF_OFF);

    await tick();

    expect(alarms.clear).toHaveBeenCalledWith(ALARM_KAHF);
    expect(notifyKahf).not.toHaveBeenCalled();
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

  it("derives the day from the Aladhan-first resolver (one time source with the UI)", async () => {
    mockStorage(ADHAN_ON, AZKAR_OFF);
    const instants = [{ key: "fajr" as const, time: new Date() }];
    vi.mocked(resolvePrayerDay).mockResolvedValue({ date: new Date(), instants });

    await tick();

    expect(resolvePrayerDay).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 30, lng: 31, method: "Egyptian", madhab: "standard" }),
    );
    // The resolver's day (not a second computePrayerTimes source) feeds arming.
    expect(nextAdhanEvent).toHaveBeenCalledWith(instants, expect.anything(), expect.anything());
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
