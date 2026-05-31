import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the server action fully — avoids pulling in the @repo/api/auth chain.
vi.mock("../actions/sign-in.action", () => ({
  signInAction: vi.fn().mockResolvedValue(undefined),
}));

import { LoginForm } from "./login-form";
import { signInAction } from "../actions/sign-in.action";

const mockSignIn = signInAction as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue(undefined);
});

describe("LoginForm — validation gating", () => {
  it("disables the submit button while the form is empty", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
  });

  it("does not call signInAction when the user tries to submit an empty form", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    // Give any async validation/submit a chance to flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("keeps the button disabled when the email format is invalid", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "secret");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled(),
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("enables the button and calls signInAction once both fields are valid", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret");

    const button = screen.getByRole("button", { name: /sign in/i });
    await waitFor(() => expect(button).toBeEnabled());

    await user.click(button);
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith(
        { email: "admin@example.com", password: "secret" },
        undefined,
      ),
    );
  });
});
