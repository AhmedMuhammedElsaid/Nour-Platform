import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render } from "@testing-library/react";

import { AdhanPlayer, type AdhanPlayerHandle } from "./adhan-player";

function setup() {
  const ref = createRef<AdhanPlayerHandle>();
  const { container } = render(<AdhanPlayer ref={ref} />);
  const audios = Array.from(container.querySelectorAll("audio"));
  const regular = audios[0]!;
  const fajr = audios[1]!;
  // jsdom doesn't implement media playback — stub per element.
  for (const el of [regular, fajr]) {
    vi.spyOn(el, "play").mockResolvedValue(undefined);
    vi.spyOn(el, "pause").mockImplementation(() => {});
  }
  return { ref, regular, fajr };
}

function setPlaying(el: HTMLAudioElement) {
  Object.defineProperty(el, "paused", { value: false, configurable: true });
}

describe("AdhanPlayer", () => {
  it("silences a still-playing regular adhan before starting the fajr one", async () => {
    const { ref, regular, fajr } = setup();
    setPlaying(regular);

    await ref.current!.play("fajr", 1);

    expect(regular.pause).toHaveBeenCalled();
    expect(fajr.play).toHaveBeenCalledTimes(1);
  });

  it("silences a still-playing fajr adhan before starting the regular one", async () => {
    const { ref, regular, fajr } = setup();
    setPlaying(fajr);

    await ref.current!.play("dhuhr", 1);

    expect(fajr.pause).toHaveBeenCalled();
    expect(regular.play).toHaveBeenCalledTimes(1);
  });

  it("unlock skips an element that is actively playing (never kills a live adhan)", () => {
    const { ref, regular, fajr } = setup();
    setPlaying(fajr);

    ref.current!.unlock();

    expect(fajr.play).not.toHaveBeenCalled();
    expect(fajr.pause).not.toHaveBeenCalled();
    expect(regular.play).toHaveBeenCalledTimes(1);
  });

  it("unlock primes only once — repeat calls are no-ops", () => {
    const { ref, regular, fajr } = setup();

    ref.current!.unlock();
    ref.current!.unlock();

    expect(regular.play).toHaveBeenCalledTimes(1);
    expect(fajr.play).toHaveBeenCalledTimes(1);
  });
});
