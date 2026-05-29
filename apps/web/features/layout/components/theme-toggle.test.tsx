import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders a toggle button accessible by label", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "toggleTheme" })).toBeInTheDocument();
  });

  it("starts in dark mode and applies data-theme=dark on mount", () => {
    render(<ThemeToggle />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("nour.theme")).toBeNull();
  });

  it("switches to light mode on first click and persists the preference", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "toggleTheme" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem("nour.theme")).toBe("light");
  });

  it("switches back to dark mode on second click", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "toggleTheme" }));
    await user.click(screen.getByRole("button", { name: "toggleTheme" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("nour.theme")).toBe("dark");
  });

  it("reads a stored light preference on mount and applies it", () => {
    window.localStorage.setItem("nour.theme", "light");
    render(<ThemeToggle />);

    // useEffect fires synchronously inside RTL's act() wrapper.
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("ignores unrecognised stored values and defaults to dark", () => {
    window.localStorage.setItem("nour.theme", "solarized");
    render(<ThemeToggle />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
