import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceWorkerRegister } from "./service-worker-register";

const ONE_HOUR_MS = 60 * 60 * 1000;

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

function setRunningBuild(build: string | undefined): void {
  if (build === undefined) delete document.documentElement.dataset.build;
  else document.documentElement.dataset.build = build;
}

// /api/health returns the currently-DEPLOYED build.
function mockHealth(version: string | undefined): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, version }),
    }),
  );
}

describe("ServiceWorkerRegister", () => {
  let reload: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let now: number;

  beforeEach(() => {
    // Component early-returns unless NODE_ENV === "production" — vitest runs
    // with NODE_ENV="test", so without this stub the whole suite would render a
    // no-op and pass vacuously.
    vi.stubEnv("NODE_ENV", "production");

    now = new Date("2026-01-01T00:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockImplementation(() => now);

    // jsdom's window.location.reload throws "Not implemented" — replace it.
    reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload },
      configurable: true,
      writable: true,
    });

    // jsdom doesn't implement navigator.serviceWorker at all.
    update = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue({ update }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: null,
      },
      configurable: true,
      writable: true,
    });

    sessionStorage.clear();
    setVisibility("visible");
    setRunningBuild("aaa1111");
  });

  afterEach(() => {
    // NOTE: do not delete navigator.serviceWorker here — this afterEach runs
    // BEFORE vitest.setup.ts's global cleanup() (afterEach hooks run in reverse
    // registration order), so the still-mounted component's teardown needs
    // navigator.serviceWorker.removeEventListener to still exist.
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hard-reloads on mount when the deployed build differs from the running build", async () => {
    mockHealth("bbb2222");
    render(<ServiceWorkerRegister />);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    // Records the target build so a later check can't reload-loop for it.
    expect(sessionStorage.getItem("nour.build.reloadedFor")).toBe("bbb2222");
  });

  it("does NOT reload when the deployed build matches the running build", async () => {
    mockHealth("aaa1111");
    render(<ServiceWorkerRegister />);
    // Give the async health check a couple of microtask turns to resolve.
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does NOT reload again for a build it has already reloaded for (loop guard)", async () => {
    sessionStorage.setItem("nour.build.reloadedFor", "bbb2222");
    mockHealth("bbb2222");
    render(<ServiceWorkerRegister />);
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does NOT reload when the running build is unknown/dev (no data-build stamp)", async () => {
    setRunningBuild(undefined);
    mockHealth("bbb2222");
    render(<ServiceWorkerRegister />);
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });

  it("re-checks and reloads on visibility gain once the throttle window has elapsed", async () => {
    // Start matched so the mount check does not reload.
    mockHealth("aaa1111");
    render(<ServiceWorkerRegister />);
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();

    // A new build deploys; the tab regains visibility after the throttle window.
    mockHealth("bbb2222");
    now += ONE_HOUR_MS;
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("does NOT re-check on visibility gain inside the throttle window", async () => {
    mockHealth("aaa1111");
    render(<ServiceWorkerRegister />);
    await Promise.resolve();
    await Promise.resolve();

    // New build deploys, but only 5 min pass — inside the 30-min throttle.
    mockHealth("bbb2222");
    now += 5 * 60 * 1000;
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });

  it("removes the visibilitychange listener on unmount", async () => {
    mockHealth("aaa1111");
    const { unmount } = render(<ServiceWorkerRegister />);
    await Promise.resolve();
    await Promise.resolve();

    unmount();

    // A stale build now deploys, but the unmounted component must not react.
    mockHealth("bbb2222");
    now += ONE_HOUR_MS;
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
  });
});
