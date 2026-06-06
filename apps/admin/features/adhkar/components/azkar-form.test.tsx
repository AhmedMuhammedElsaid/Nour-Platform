import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AzkarForm } from "./azkar-form";

describe("AzkarForm", () => {
  const baseProps = {
    mode: "create" as const,
    onSubmit: vi.fn(async () => undefined),
  };

  it("renders one empty dhikr row by default", () => {
    render(<AzkarForm {...baseProps} />);
    expect(screen.getAllByTestId("dhikr-row")).toHaveLength(1);
  });

  it("adds a dhikr row when 'Add dhikr' is clicked", () => {
    render(<AzkarForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add dhikr/i }));
    expect(screen.getAllByTestId("dhikr-row")).toHaveLength(2);
  });

  it("removes a dhikr row", () => {
    render(<AzkarForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /add dhikr/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /remove dhikr/i })[0]!);
    expect(screen.getAllByTestId("dhikr-row")).toHaveLength(1);
  });

  it("does not call onSubmit when the Arabic title is empty", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<AzkarForm mode="create" onSubmit={onSubmit} />);
    // The default Arabic title is empty, so onSubmit validation must block.
    fireEvent.click(screen.getByRole("button", { name: /create azkar/i }));
    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
