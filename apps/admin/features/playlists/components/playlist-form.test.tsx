import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock server actions fully — avoids pulling in the @repo/api/auth chain.
vi.mock("../actions/create-playlist.action", () => ({
  createPlaylistAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../actions/update-playlist.action", () => ({
  updatePlaylistAction: vi.fn().mockResolvedValue(undefined),
}));

import { PlaylistForm } from "./playlist-form";
import { createPlaylistAction } from "../actions/create-playlist.action";
import { updatePlaylistAction } from "../actions/update-playlist.action";

const mockCreate = createPlaylistAction as ReturnType<typeof vi.fn>;
const mockUpdate = updatePlaylistAction as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockCreate.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
});

describe("PlaylistForm — create mode", () => {
  it("renders empty form with AR and EN title fields and create button", () => {
    render(<PlaylistForm mode="create" availableCategories={[]} />);
    expect(screen.getByLabelText(/title \(arabic\)/i)).toHaveValue("");
    expect(screen.getByLabelText(/title \(english\)/i)).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /create playlist/i }),
    ).toBeInTheDocument();
  });

  it("calls createPlaylistAction with bilingual form values on valid submit", async () => {
    const user = userEvent.setup();
    render(<PlaylistForm mode="create" availableCategories={[]} />);
    await user.type(screen.getByLabelText(/title \(arabic\)/i), "عنوان عربي");
    await user.type(screen.getByLabelText(/title \(english\)/i), "English Title");
    await user.click(screen.getByRole("button", { name: /create playlist/i }));
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          ar: expect.objectContaining({ title: "عنوان عربي" }),
          en: expect.objectContaining({ title: "English Title" }),
          status: "draft",
        }),
      ),
    );
  });

  it("shows server error when action returns error", async () => {
    mockCreate.mockResolvedValueOnce({ error: "Duplicate slug." });
    const user = userEvent.setup();
    render(<PlaylistForm mode="create" availableCategories={[]} />);
    await user.type(screen.getByLabelText(/title \(arabic\)/i), "عنوان");
    await user.type(screen.getByLabelText(/title \(english\)/i), "Title");
    await user.click(screen.getByRole("button", { name: /create playlist/i }));
    expect(await screen.findByText("Duplicate slug.")).toBeInTheDocument();
  });
});

describe("PlaylistForm — edit mode", () => {
  const editProps = {
    mode: "edit" as const,
    playlistId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    availableCategories: [],
    defaultValues: {
      ar: { title: "عنوان موجود", description: "" },
      en: { title: "Existing Title", description: "Existing desc" },
      status: "published" as const,
      categoryIds: [] as string[],
    },
  };

  it("pre-populates form with defaultValues", () => {
    render(<PlaylistForm {...editProps} />);
    expect(screen.getByLabelText(/title \(arabic\)/i)).toHaveValue("عنوان موجود");
    expect(screen.getByLabelText(/title \(english\)/i)).toHaveValue("Existing Title");
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it("calls updatePlaylistAction with id and updated form values on submit", async () => {
    const user = userEvent.setup();
    render(<PlaylistForm {...editProps} />);
    const enTitle = screen.getByLabelText(/title \(english\)/i);
    await user.clear(enTitle);
    await user.type(enTitle, "Updated Title");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        "aaaaaaaaaaaaaaaaaaaaaaaa",
        expect.objectContaining({
          en: expect.objectContaining({ title: "Updated Title" }),
        }),
      ),
    );
  });
});
