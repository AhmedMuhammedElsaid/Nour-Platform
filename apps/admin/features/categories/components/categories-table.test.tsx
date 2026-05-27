import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/link renders fine in the browser but needs the Next.js router context
// in tests. Stub it to a plain anchor to avoid that dependency.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../actions/delete-category.action", () => ({
  deleteCategoryAction: vi.fn().mockResolvedValue({ ok: true }),
}));

import { CategoriesTable } from "./categories-table";
import type { CategoryRow } from "./categories-table";
import { deleteCategoryAction } from "../actions/delete-category.action";

const mockDelete = deleteCategoryAction as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockDelete.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const rows: CategoryRow[] = [
  {
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    ar: { name: "دراسات قرآنية", slug: "دراسات-قرآنية" },
    en: { name: "Quran Studies", slug: "quran-studies" },
    createdAt: "2024-01-15T00:00:00.000Z",
    updatedAt: "2024-01-15T00:00:00.000Z",
  },
  {
    id: "bbbbbbbbbbbbbbbbbbbbbbbb",
    ar: { name: "تمويل إسلامي", slug: "تمويل-إسلامي" },
    en: { name: "Islamic Finance", slug: "islamic-finance", description: "Finance topics" },
    createdAt: "2024-02-20T00:00:00.000Z",
    updatedAt: "2024-02-20T00:00:00.000Z",
  },
];

describe("CategoriesTable", () => {
  it("renders rows with correct AR name and EN name columns", () => {
    render(<CategoriesTable categories={rows} />);
    expect(screen.getByText("دراسات قرآنية")).toBeInTheDocument();
    expect(screen.getByText("Quran Studies")).toBeInTheDocument();
    expect(screen.getByText("تمويل إسلامي")).toBeInTheDocument();
    expect(screen.getByText("Islamic Finance")).toBeInTheDocument();
  });

  it("shows empty state when no categories are provided", () => {
    render(<CategoriesTable categories={[]} />);
    expect(screen.getByText("No categories found.")).toBeInTheDocument();
  });

  it("AR name cell links to the edit page", () => {
    render(<CategoriesTable categories={rows} />);
    const link = screen.getByRole("link", { name: "دراسات قرآنية" });
    expect(link).toHaveAttribute(
      "href",
      "/categories/aaaaaaaaaaaaaaaaaaaaaaaa/edit",
    );
  });

  it("delete button triggers confirm flow and calls deleteCategoryAction", async () => {
    // Spy on window.confirm and auto-accept.
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);

    const user = userEvent.setup();
    render(<CategoriesTable categories={rows} />);

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]!);

    expect(window.confirm).toHaveBeenCalledWith(
      "Delete this category? This cannot be undone.",
    );
    expect(mockDelete).toHaveBeenCalledWith("aaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("does not call deleteCategoryAction when confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);

    const user = userEvent.setup();
    render(<CategoriesTable categories={rows} />);

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]!);

    expect(mockDelete).not.toHaveBeenCalled();
  });
});
