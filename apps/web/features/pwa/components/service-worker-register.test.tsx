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

function dispatchVisibilityChange(): void {
  document.dispatchEvent(new Event("visibilitychange"));
}

// register() runs either immediately (readyState === "complete") or on the
// window 'load' event. jsdom's readyState is usually already "complete", but
// dispatching 'load' unconditionally is harmless (no listener is attached in
// the immediate-run case) and keeps this robust either way.
function ensureRegistered(): void {
  window.dispatchEvent(new Event("load"));
}

describe("ServiceWorkerRegister", () => {
  let update: ReturnType<typeof vi.fn>;
  let register: ReturnType<typeof vi.fn>;
  let now: number;

  beforeEach(() => {
    // Component early-returns unless NODE_ENV === "production" — vitest runs
    // with NODE_ENV="test", so without this stub the whole suite would
    // render a no-op and pass vacuously.
    vi.stubEnv("NODE_ENV", "production");

    now = new Date("2026-01-01T00:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockImplementation(() => now);

    update = vi.fn().mockResolvedValue(undefined);
    register = vi.fn().mockResolvedValue({ update });

    // jsdom doesn't implement navigator.serviceWorker at all.
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: null,
      },
      configurable: true,
      writable: true,
    });

    setVisibility("visible");
  });

  afterEach(() => {
    // NOTE: do not delete navigator.serviceWorker here. This afterEach runs
    // BEFORE vitest.setup.ts's global `cleanup()` (afterEach hooks run in
    // reverse registration order), so the still-mounted component's effect
    // teardown needs navigator.serviceWorker.removeEventListener to still
    // exist. The next test's beforeEach redefines the property anyway.
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("calls reg.update() again once the 60-minute throttle window has elapsed", async () => {
    render(<ServiceWorkerRegister />);
    ensureRegistered();

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    // register() itself triggers one seed update() — clear it so the
    // assertion below is only about the visibility-driven call.
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    update.mockClear();

    now += ONE_HOUR_MS + 1000;
    dispatchVisibilityChange();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  });

  it("does NOT call reg.update() again when the tab regains visibility inside the throttle window", async () => {
    render(<ServiceWorkerRegister />);
    ensureRegistered();

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    update.mockClear();

    // Still well inside the 60-minute window.
    now += 5 * 60 * 1000;
    dispatchVisibilityChange();

    // Nothing async left to await for a call that should never happen, but
    // give a pending microtask a turn before asserting.
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
  });

  it("removes the visibilitychange listener on unmount", async () => {
    const { unmount } = render(<ServiceWorkerRegister />);
    ensureRegistered();

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    update.mockClear();

    unmount();

    now += ONE_HOUR_MS + 1000;
    dispatchVisibilityChange();

    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
  });
});
