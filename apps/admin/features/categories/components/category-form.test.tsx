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
  it("renders empty form with AR and EN name fields and create button", () => {
    render(<CategoryForm mode="create" />);
    expect(screen.getByLabelText(/name \(arabic\)/i)).toHaveValue("");
    expect(screen.getByLabelText(/name \(english\)/i)).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /create category/i }),
    ).toBeInTheDocument();
  });

  it("calls createCategoryAction with bilingual form values on valid submit", async () => {
    const user = userEvent.setup();
    render(<CategoryForm mode="create" />);

    await user.type(screen.getByLabelText(/name \(arabic\)/i), "تمويل إسلامي");
    await user.type(screen.getByLabelText(/name \(english\)/i), "Islamic Finance");
    await user.click(
      screen.getByRole("button", { name: /create category/i }),
    );

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          ar: expect.objectContaining({ name: "تمويل إسلامي" }),
          en: expect.objectContaining({ name: "Islamic Finance" }),
        }),
      ),
    );
  });

  it("shows server error when action returns error", async () => {
    mockCreate.mockResolvedValueOnce({ error: "Slug already taken." });
    const user = userEvent.setup();
    render(<CategoryForm mode="create" />);

    await user.type(screen.getByLabelText(/name \(arabic\)/i), "فقه");
    await user.type(screen.getByLabelText(/name \(english\)/i), "Fiqh");
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
      ar: { name: "فئة موجودة", description: "وصف موجود" },
      en: { name: "Existing Category", description: "An existing description" },
      coverMediaId: "",
    },
  };

  it("renders in edit mode with initialValues pre-filled", () => {
    render(<CategoryForm {...editProps} />);
    expect(screen.getByLabelText(/name \(arabic\)/i)).toHaveValue("فئة موجودة");
    expect(screen.getByLabelText(/name \(english\)/i)).toHaveValue("Existing Category");
    expect(screen.getByLabelText(/description \(english\)/i)).toHaveValue(
      "An existing description",
    );
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it("calls updateCategoryAction with id and updated form values on submit", async () => {
    const user = userEvent.setup();
    render(<CategoryForm {...editProps} />);
    const enName = screen.getByLabelText(/name \(english\)/i);
    await user.clear(enName);
    await user.type(enName, "Updated Category");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        "aaaaaaaaaaaaaaaaaaaaaaaa",
        expect.objectContaining({
          en: expect.objectContaining({ name: "Updated Category" }),
        }),
      ),
    );
  });
});
