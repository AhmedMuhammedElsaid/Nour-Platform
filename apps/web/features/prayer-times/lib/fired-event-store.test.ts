// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { claimFiredEvent } from "./fired-event-store";

const KEY = "nour.test.fired";
const ISO_A = "2026-06-11T12:00:00.000Z";
const ISO_B = "2026-06-11T15:30:00.000Z";

afterEach(() => {
  localStorage.clear();
});

describe("claimFiredEvent", () => {
  it("grants the first claim for an event", async () => {
    await expect(claimFiredEvent(KEY, ISO_A)).resolves.toBe(true);
  });

  it("rejects a second claim for the same event (same tab, later path)", async () => {
    await claimFiredEvent(KEY, ISO_A);
    await expect(claimFiredEvent(KEY, ISO_A)).resolves.toBe(false);
  });

  it("rejects a claim when another tab already recorded the event", async () => {
    // Simulate another tab's record: same event ISO, different owner id.
    localStorage.setItem(KEY, JSON.stringify({ iso: ISO_A, owner: "other-tab" }));
    await expect(claimFiredEvent(KEY, ISO_A)).resolves.toBe(false);
  });

  it("grants a claim for a new event after an older one was recorded", async () => {
    await claimFiredEvent(KEY, ISO_A);
    await expect(claimFiredEvent(KEY, ISO_B)).resolves.toBe(true);
  });

  it("grants exactly one of two racing claims for the same event", async () => {
    const [a, b] = await Promise.all([
      claimFiredEvent(KEY, ISO_A),
      claimFiredEvent(KEY, ISO_A),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("ignores a corrupt stored record and still grants the claim", async () => {
    localStorage.setItem(KEY, "{not json");
    await expect(claimFiredEvent(KEY, ISO_A)).resolves.toBe(true);
  });
});
