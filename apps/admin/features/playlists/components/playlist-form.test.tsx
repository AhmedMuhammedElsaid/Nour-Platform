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
  it("renders empty form with create button", () => {
    render(<PlaylistForm mode="create" />);
    expect(screen.getByLabelText(/title/i)).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /create playlist/i }),
    ).toBeInTheDocument();
  });

  it("shows validation error when title is cleared after typing", async () => {
    const user = userEvent.setup();
    render(<PlaylistForm mode="create" />);
    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, "a");
    await user.clear(titleInput);
    expect(await screen.findByText("Title is required.")).toBeInTheDocument();
  });

  it("calls createPlaylistAction with form values on valid submit", async () => {
    const user = userEvent.setup();
    render(<PlaylistForm mode="create" />);
    await user.type(screen.getByLabelText(/title/i), "My Playlist");
    await user.click(screen.getByRole("button", { name: /create playlist/i }));
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "My Playlist", status: "draft" }),
      ),
    );
  });

  it("shows server error when action returns error", async () => {
    mockCreate.mockResolvedValueOnce({ error: "Duplicate slug." });
    const user = userEvent.setup();
    render(<PlaylistForm mode="create" />);
    await user.type(screen.getByLabelText(/title/i), "My Playlist");
    await user.click(screen.getByRole("button", { name: /create playlist/i }));
    expect(await screen.findByText("Duplicate slug.")).toBeInTheDocument();
  });
});

describe("PlaylistForm — edit mode", () => {
  const editProps = {
    mode: "edit" as const,
    playlistId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    defaultValues: {
      title: "Existing Title",
      description: "Existing desc",
      status: "published" as const,
    },
  };

  it("pre-populates form with defaultValues", () => {
    render(<PlaylistForm {...editProps} />);
    expect(screen.getByLabelText(/title/i)).toHaveValue("Existing Title");
    expect(screen.getByLabelText(/description/i)).toHaveValue("Existing desc");
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it("calls updatePlaylistAction with id and form values on submit", async () => {
    const user = userEvent.setup();
    render(<PlaylistForm {...editProps} />);
    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), "Updated Title");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        "aaaaaaaaaaaaaaaaaaaaaaaa",
        expect.objectContaining({ title: "Updated Title" }),
      ),
    );
  });
});
