import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrackDurationBackfill } from "./track-duration-backfill";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../actions/update-track-duration.action", () => ({
  updateTrackDurationAction: vi.fn(),
}));
vi.mock("../lib/audio-duration", () => ({ durationFromSrc: vi.fn() }));

describe("TrackDurationBackfill", () => {
  it("renders nothing when no playable track is missing a duration", () => {
    const { container } = render(
      <TrackDurationBackfill
        tracks={[
          { id: "a", srcUrl: "u", durationSecs: 100 },
          // unplayable (no media URL) — can't be backfilled, so ignored
          { id: "b", srcUrl: null },
        ]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("counts only playable tracks missing a duration", () => {
    render(
      <TrackDurationBackfill
        tracks={[
          { id: "a", srcUrl: "u1" },
          { id: "b", srcUrl: "u2", durationSecs: 50 },
          { id: "c", srcUrl: "u3" },
          { id: "d", srcUrl: null },
        ]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Backfill durations \(2\)/ }),
    ).toBeInTheDocument();
  });
});
