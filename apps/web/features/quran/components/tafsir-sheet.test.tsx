import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TafsirSheet } from "./tafsir-sheet";

afterEach(() => vi.restoreAllMocks());

describe("TafsirSheet", () => {
  it("fetches and renders tafsir html when opened", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        edition: { slug: "en.ibnkathir", name: "Ibn Kathir", dir: "ltr" },
        html: "<p>Explanation</p>",
      }),
    }));
    render(<TafsirSheet ayah={{ numberGlobal: 1, ref: "1:1" }} locale="en" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Explanation")).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/quran/tafsir?ayah=1&locale=en"),
    );
  });

  it("shows an error state when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    render(<TafsirSheet ayah={{ numberGlobal: 1, ref: "1:1" }} locale="ar" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("tafsir-error")).toBeInTheDocument());
  });
});
