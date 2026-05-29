import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { SearchBox } from "./search-box";

describe("SearchBox", () => {
  beforeEach(() => push.mockClear());

  it("navigates to the search route with the encoded query on submit", async () => {
    const user = userEvent.setup();
    render(<SearchBox />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "al fatiha{enter}");

    expect(push).toHaveBeenCalledWith("/search?q=al%20fatiha");
  });

  it("does not navigate on an empty/whitespace query", async () => {
    const user = userEvent.setup();
    render(<SearchBox />);

    await user.type(screen.getByRole("searchbox"), "   {enter}");
    expect(push).not.toHaveBeenCalled();
  });
});
