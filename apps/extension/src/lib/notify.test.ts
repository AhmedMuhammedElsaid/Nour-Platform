import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({ get: vi.fn() }));

import { get } from "./storage";
import { handleNotificationClick } from "./notify";

const SABAH_SLUG = "أذكار-الصباح";
const MASAA_SLUG = "أذكار-المساء";

const tabs = { create: vi.fn(async () => ({})) };
const notifications = { clear: vi.fn(async () => true) };
const runtime = {
  getURL: vi.fn((path: string) => `chrome-extension://abc/${path}`),
};

vi.stubGlobal("chrome", { tabs, notifications, runtime });

describe("handleNotificationClick", () => {
  beforeEach(() => {
    tabs.create.mockClear();
    notifications.clear.mockClear();
    vi.mocked(get).mockResolvedValue({
      enabled: true,
      offsetMinutes: 20,
      sabah: { ar: SABAH_SLUG },
      masaa: { ar: MASAA_SLUG },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it("opens the built-in new-tab reader for a sabah reminder", async () => {
    await handleNotificationClick("nour:azkar:sabah");
    expect(tabs.create).toHaveBeenCalledWith({
      url: `chrome-extension://abc/src/newtab/index.html#/adhkar/${encodeURIComponent(SABAH_SLUG)}`,
    });
    expect(notifications.clear).toHaveBeenCalledWith("nour:azkar:sabah");
  });

  it("opens the masaa reader slug for a masaa reminder", async () => {
    await handleNotificationClick("nour:azkar:masaa");
    expect(tabs.create).toHaveBeenCalledWith({
      url: `chrome-extension://abc/src/newtab/index.html#/adhkar/${encodeURIComponent(MASAA_SLUG)}`,
    });
  });

  it("still opens the website for the adhan notification", async () => {
    await handleNotificationClick("nour:adhan");
    expect(tabs.create).toHaveBeenCalledWith({ url: "https://site.test" });
    expect(notifications.clear).toHaveBeenCalledWith("nour:adhan");
  });
});
