import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// next-intl: return English labels for the `errors` namespace keys this uses.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      errorEyebrow: "Unexpected error",
      title: "Something went wrong",
      description: "An unexpected error stopped this page from loading.",
      retry: "Try again",
    })[key] ?? key,
}));

import LocaleError from "./error";

const error = Object.assign(new Error("boom"), { digest: "abc123" });

describe("LocaleError", () => {
  it("renders the localized error heading and description", () => {
    render(<LocaleError error={error} reset={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unexpected error")).toBeInTheDocument();
    expect(
      screen.getByText("An unexpected error stopped this page from loading."),
    ).toBeInTheDocument();
  });

  it("does not leak the raw error message or digest to the user", () => {
    render(<LocaleError error={error} reset={vi.fn()} />);

    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
    expect(screen.queryByText(/abc123/)).not.toBeInTheDocument();
  });

  it("calls reset() when the retry button is clicked", async () => {
    const reset = vi.fn();
    render(<LocaleError error={error} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
