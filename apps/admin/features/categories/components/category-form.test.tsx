import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock server actions fully — avoids pulling in the @repo/api/auth chain.
vi.mock("../actions/create-category.action", () => ({
  createCategoryAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../actions/update-category.action", () => ({
  updateCategoryAction: vi.fn().mockResolvedValue(undefined),
}));

import { CategoryForm } from "./category-form";
import { createCategoryAction } from "../actions/create-category.action";
import { updateCategoryAction } from "../actions/update-category.action";

const mockCreate = createCategoryAction as ReturnType<typeof vi.fn>;
const mockUpdate = updateCategoryAction as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockCreate.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
});

describe("CategoryForm — create mode", () => {
  it("renders empty form with create button", () => {
    render(<CategoryForm mode="create" />);
    expect(screen.getByLabelText(/name/i)).toHaveValue("");
    expect(screen.getByLabelText(/slug/i)).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /create category/i }),
    ).toBeInTheDocument();
  });

  it("auto-derives slug from name while slug has not been manually edited", async () => {
    const user = userEvent.setup();
    render(<CategoryForm mode="create" />);
    const nameInput = screen.getByLabelText(/name/i);
    const slugInput = screen.getByLabelText(/slug/i);

    await user.type(nameInput, "My Islamic Topic");

    // The slug field should reflect the auto-derived value.
    expect(slugInput).toHaveValue("my-islamic-topic");
  });

  it("stops auto-deriving slug once slug field is edited directly", async () => {
    const user = userEvent.setup();
    render(<CategoryForm mode="create" />);
    const nameInput = screen.getByLabelText(/name/i);
    const slugInput = screen.getByLabelText(/slug/i);

    // Type a name first so slug gets auto-derived.
    await user.type(nameInput, "Quran");
    expect(slugInput).toHaveValue("quran");

    // Now edit the slug directly — this should lock it.
    await user.clear(slugInput);
    await user.type(slugInput, "my-custom-slug");

    // Changing the name after manual slug edit must not update slug.
    await user.type(nameInput, " Studies");
    expect(slugInput).toHaveValue("my-custom-slug");
  });

  it("calls createCategoryAction with form values on valid submit", async () => {
    const user = userEvent.setup();
    render(<CategoryForm mode="create" />);

    await user.type(screen.getByLabelText(/name/i), "Islamic Finance");
    await user.click(
      screen.getByRole("button", { name: /create category/i }),
    );

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Islamic Finance" }),
      ),
    );
  });

  it("shows server error when action returns error", async () => {
    mockCreate.mockResolvedValueOnce({ error: "Slug already taken." });
    const user = userEvent.setup();
    render(<CategoryForm mode="create" />);

    await user.type(screen.getByLabelText(/name/i), "Fiqh");
    await user.click(
      screen.getByRole("button", { name: /create category/i }),
    );

    expect(await screen.findByText("Slug already taken.")).toBeInTheDocument();
  });
});

describe("CategoryForm — edit mode", () => {
  const editProps = {
    mode: "edit" as const,
    categoryId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    initialValues: {
      name: "Existing Category",
      slug: "existing-category",
      description: "An existing description",
      coverMediaId: "",
    },
  };

  it("renders in edit mode with initialValues pre-filled", () => {
    render(<CategoryForm {...editProps} />);
    expect(screen.getByLabelText(/name/i)).toHaveValue("Existing Category");
    expect(screen.getByLabelText(/slug/i)).toHaveValue("existing-category");
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      "An existing description",
    );
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it("calls updateCategoryAction with id and form values on submit", async () => {
    const user = userEvent.setup();
    render(<CategoryForm {...editProps} />);
    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Category");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        "aaaaaaaaaaaaaaaaaaaaaaaa",
        expect.objectContaining({ name: "Updated Category" }),
      ),
    );
  });
});
