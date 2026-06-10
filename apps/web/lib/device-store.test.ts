import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { readDeviceStore, writeDeviceStore } from "./device-store";

const schema = z.object({ volume: z.number().min(0).max(1) });
const FALLBACK = { volume: 1 };

describe("device-store", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns the fallback when the key is absent", () => {
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual(FALLBACK);
  });

  it("round-trips a valid value", () => {
    writeDeviceStore("nour.test", { volume: 0.5 });
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual({ volume: 0.5 });
  });

  it("returns the fallback for corrupt JSON and for shape mismatches", () => {
    window.localStorage.setItem("nour.test", "{not json");
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual(FALLBACK);
    window.localStorage.setItem("nour.test", JSON.stringify({ volume: "loud" }));
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual(FALLBACK);
  });

  it("is SSR-safe (no window)", () => {
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("denied");
    };
    expect(readDeviceStore("nour.test", schema, FALLBACK)).toEqual(FALLBACK);
    window.localStorage.getItem = original;
  });
});
