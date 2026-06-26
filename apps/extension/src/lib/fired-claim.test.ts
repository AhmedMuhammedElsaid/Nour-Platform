import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADHAN_FIRED_KEY,
  AZKAR_REMINDER_FIRED_KEY,
  claimFiredEvent,
} from "./fired-claim";

const store: Record<string, unknown> = {};

const storageMock = {
  get: vi.fn(async (key: string | string[]) => {
    if (typeof key === "string") return { [key]: store[key] };
    return Object.fromEntries((key as string[]).map((k) => [k, store[k]]));
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  }),
};

vi.stubGlobal("chrome", { storage: { local: storageMock } });

describe("claimFiredEvent", () => {
  const ISO = "2026-06-24T04:30:00.000Z";

  beforeEach(() => {
    Object.keys(store).forEach((k) => { delete store[k]; });
    storageMock.get.mockClear();
    storageMock.set.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("grants the claim when storage is empty", async () => {
    const p = claimFiredEvent(ADHAN_FIRED_KEY, ISO);
    await vi.runAllTimersAsync();
    expect(await p).toBe(true);
  });

  it("rejects when the same ISO is already stored (duplicate fire)", async () => {
    store[ADHAN_FIRED_KEY] = { iso: ISO, owner: "other-context" };
    const p = claimFiredEvent(ADHAN_FIRED_KEY, ISO);
    await vi.runAllTimersAsync();
    expect(await p).toBe(false);
  });

  it("grants when a different ISO is stored (new prayer, evict old)", async () => {
    store[ADHAN_FIRED_KEY] = { iso: "2026-06-24T00:00:00.000Z", owner: "old" };
    const p = claimFiredEvent(ADHAN_FIRED_KEY, ISO);
    await vi.runAllTimersAsync();
    expect(await p).toBe(true);
  });

  it("loses the race when a concurrent context out-writes us (last-writer-wins)", async () => {
    // After we write, a racing context overwrites with the same ISO under its own owner.
    storageMock.set.mockImplementationOnce(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
      store[ADHAN_FIRED_KEY] = { iso: ISO, owner: "racing-context" };
    });
    const p = claimFiredEvent(ADHAN_FIRED_KEY, ISO);
    await vi.runAllTimersAsync();
    expect(await p).toBe(false);
  });

  it("fails open when storage.get throws (notify rather than silence)", async () => {
    storageMock.get.mockRejectedValueOnce(new Error("quota exceeded"));
    const p = claimFiredEvent(ADHAN_FIRED_KEY, ISO);
    await vi.runAllTimersAsync();
    expect(await p).toBe(true);
  });

  it("key constants match the web storage contract", () => {
    expect(ADHAN_FIRED_KEY).toBe("nour.prayer.adhan.fired");
    expect(AZKAR_REMINDER_FIRED_KEY).toBe("nour.azkar.reminder.fired");
  });
});
