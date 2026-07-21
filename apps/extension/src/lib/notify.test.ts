import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({ get: vi.fn() }));
vi.mock("./audio-router", () => ({ stop: vi.fn(async () => {}) }));

import { stop } from "./audio-router";
import { get } from "./storage";
import {
  handleAdhanNotificationButton,
  handleNotificationClick,
  notifyAdhan,
} from "./notify";

const SABAH_SLUG = "أذكار-الصباح";
const MASAA_SLUG = "أذكار-المساء";

const tabs = { create: vi.fn(async () => ({})) };
const notifications = {
  clear: vi.fn(async () => true),
  create: vi.fn(async () => "nour:adhan"),
};
const runtime = {
  getURL: vi.fn((path: string) => `chrome-extension://abc/${path}`),
};

vi.stubGlobal("chrome", { tabs, notifications, runtime });

describe("handleNotificationClick", () => {
  beforeEach(() => {
    tabs.create.mockClear();
    notifications.clear.mockClear();
    notifications.create.mockClear();
    vi.mocked(stop).mockClear();
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

  it("opens the built-in Quran reader at Surah Al-Kahf for the kahf reminder", async () => {
    await handleNotificationClick("nour:kahf:reminder");
    expect(tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://abc/src/newtab/index.html#/quran/18",
    });
    expect(notifications.clear).toHaveBeenCalledWith("nour:kahf:reminder");
  });

  it("still opens the website for the adhan notification", async () => {
    await handleNotificationClick("nour:adhan");
    expect(tabs.create).toHaveBeenCalledWith({ url: "https://site.test" });
    expect(notifications.clear).toHaveBeenCalledWith("nour:adhan");
    expect(stop).not.toHaveBeenCalled();
  });
});

describe("adhan stop button", () => {
  beforeEach(() => {
    notifications.clear.mockClear();
    notifications.create.mockClear();
    vi.mocked(stop).mockClear();
  });

  it("names the prayer and offers a stop button", async () => {
    await notifyAdhan("dhuhr");
    expect(notifications.create).toHaveBeenCalledWith(
      "nour:adhan",
      expect.objectContaining({
        title: "الظهر",
        buttons: [{ title: "إيقاف الأذان" }],
      }),
    );
  });

  it("stops the adhan and clears the notification when the button is pressed", async () => {
    await handleAdhanNotificationButton("nour:adhan", 0);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(notifications.clear).toHaveBeenCalledWith("nour:adhan");
  });

  it("ignores buttons on other notifications", async () => {
    await handleAdhanNotificationButton("nour:azkar:sabah", 0);
    expect(stop).not.toHaveBeenCalled();
    expect(notifications.clear).not.toHaveBeenCalled();
  });
});
