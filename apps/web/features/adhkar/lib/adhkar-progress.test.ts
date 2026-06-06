import { describe, it, expect, beforeEach } from "vitest";
import {
  readAzkarProgress,
  recordDhikrCount,
  resetIfNewDay,
  isSetComplete,
} from "./adhkar-progress";

beforeEach(() => window.localStorage.clear());

describe("adhkar-progress", () => {
  it("records a count for a set/item index", () => {
    recordDhikrCount("set1", 0, 2);
    expect(readAzkarProgress().sets["set1"]?.["0"]).toBe(2);
  });

  it("resets when stored date is not today", () => {
    window.localStorage.setItem(
      "nour.adhkar.progress",
      JSON.stringify({ date: "2000-01-01", sets: { set1: { "0": 5 } } }),
    );
    resetIfNewDay();
    expect(readAzkarProgress().sets).toEqual({});
  });

  it("keeps progress on the same day", () => {
    recordDhikrCount("set1", 0, 3);
    resetIfNewDay();
    expect(readAzkarProgress().sets["set1"]?.["0"]).toBe(3);
  });

  it("isSetComplete true only when every item reaches its repeat", () => {
    recordDhikrCount("set1", 0, 3);
    recordDhikrCount("set1", 1, 1);
    expect(isSetComplete("set1", [3, 1])).toBe(true);
    expect(isSetComplete("set1", [3, 2])).toBe(false);
  });
});
