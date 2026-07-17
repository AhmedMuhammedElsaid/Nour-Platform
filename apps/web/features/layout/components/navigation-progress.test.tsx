import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const navState = { pathname: "/ar", search: "" };
vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.search),
}));

import {
  NavigationProgress,
  startNavigationProgress,
} from "./navigation-progress";

// Anchor click helper — preventDefault at the target so jsdom doesn't try to
// navigate; the bar's capture-phase listener runs before this handler.
function renderWithLink(href: string, extra?: { target?: string; ctrl?: boolean }) {
  render(
    <>
      <a href={href} target={extra?.target} onClick={(e) => e.preventDefault()}>
        go
      </a>
      <NavigationProgress />
    </>,
  );
  fireEvent.click(screen.getByText("go"), {
    button: 0,
    ctrlKey: extra?.ctrl ?? false,
  });
}

describe("NavigationProgress", () => {
  beforeEach(() => {
    navState.pathname = "/ar";
    navState.search = "";
    window.history.replaceState(null, "", "/ar");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts on an internal link click", () => {
    renderWithLink("/ar/playlists/x");
    expect(screen.getByTestId("nav-progress")).toBeInTheDocument();
  });

  it("ignores modified clicks (ctrl)", () => {
    renderWithLink("/ar/playlists/x", { ctrl: true });
    expect(screen.queryByTestId("nav-progress")).toBeNull();
  });

  it("ignores target=_blank links", () => {
    renderWithLink("/ar/playlists/x", { target: "_blank" });
    expect(screen.queryByTestId("nav-progress")).toBeNull();
  });

  it("ignores same-URL / hash-only clicks", () => {
    renderWithLink("/ar#section");
    expect(screen.queryByTestId("nav-progress")).toBeNull();
  });

  it("starts via startNavigationProgress() for imperative navigations", () => {
    render(<NavigationProgress />);
    act(() => startNavigationProgress());
    expect(screen.getByTestId("nav-progress")).toBeInTheDocument();
  });

  it("completes and hides when the route lands", () => {
    vi.useFakeTimers();
    const { rerender } = render(<NavigationProgress />);
    act(() => startNavigationProgress());
    expect(screen.getByTestId("nav-progress")).toBeInTheDocument();

    navState.pathname = "/ar/quran";
    rerender(<NavigationProgress />);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByTestId("nav-progress")).toBeNull();
  });
});
