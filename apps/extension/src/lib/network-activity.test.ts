import { describe, expect, it, vi } from "vitest";

import {
  beginRequest,
  endRequest,
  getInflightCount,
  subscribe,
} from "./network-activity";

// Each case balances its own begin/end calls and unsubscribes any listener it
// adds — module state (`inflightCount`, `listeners`) is a shared singleton
// across the whole file, so leaving either dirty would leak into later tests.

describe("network-activity", () => {
  it("increments and decrements the in-flight counter", () => {
    expect(getInflightCount()).toBe(0);
    beginRequest();
    beginRequest();
    expect(getInflightCount()).toBe(2);
    endRequest();
    expect(getInflightCount()).toBe(1);
    endRequest();
    expect(getInflightCount()).toBe(0);
  });

  it("never goes below zero on an unmatched endRequest()", () => {
    endRequest();
    endRequest();
    expect(getInflightCount()).toBe(0);
  });

  it("calls a subscriber immediately with the current count", () => {
    beginRequest();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    expect(listener).toHaveBeenCalledWith(1);
    unsubscribe();
    endRequest();
  });

  it("notifies subscribers on every begin/end", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    listener.mockClear(); // drop the immediate call-on-subscribe

    beginRequest();
    expect(listener).toHaveBeenLastCalledWith(1);
    beginRequest();
    expect(listener).toHaveBeenLastCalledWith(2);
    endRequest();
    expect(listener).toHaveBeenLastCalledWith(1);
    endRequest();
    expect(listener).toHaveBeenLastCalledWith(0);
    unsubscribe();
  });

  it("stops notifying an unsubscribed listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    listener.mockClear();

    unsubscribe();
    beginRequest();
    expect(listener).not.toHaveBeenCalled();
    endRequest();
  });

  it("supports multiple independent subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribe(a);
    const unsubB = subscribe(b);
    a.mockClear();
    b.mockClear();

    beginRequest();
    expect(a).toHaveBeenLastCalledWith(1);
    expect(b).toHaveBeenLastCalledWith(1);
    endRequest();
    unsubA();
    unsubB();
  });
});
