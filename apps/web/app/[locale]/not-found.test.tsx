import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next-intl server helper: echo English copy for the `errors` namespace keys.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) =>
    ({
      notFoundEyebrow: "Error 404",
      notFoundTitle: "This page could not be found",
      notFoundDescription: "The page you are looking for may have been moved.",
      backHome: "Back to home",
    })[key] ?? key,
}));

// The locale-aware Link resolves to /ar or /en at runtime; in a unit test we
// only care that the 404 links home, so a plain anchor is enough.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import LocaleNotFound from "./not-found";

describe("LocaleNotFound", () => {
  it("renders the localized 404 heading and description", async () => {
    // Async server component: await it to get the element tree, then render.
    render(await LocaleNotFound());

    expect(
      screen.getByRole("heading", { name: "This page could not be found" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Error 404")).toBeInTheDocument();
    expect(
      screen.getByText("The page you are looking for may have been moved."),
    ).toBeInTheDocument();
  });

  it("links back to the locale home", async () => {
    render(await LocaleNotFound());

    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
