import { render, screen } from "@testing-library/react-native";

import { Spinner } from "@/components/ui/spinner";

describe("Spinner", () => {
  it("exposes its label to screen readers", () => {
    render(<Spinner label="Loading…" />);
    expect(screen.getByLabelText("Loading…")).toBeTruthy();
  });

  it("renders without a label", () => {
    const tree = render(<Spinner size="small" />);
    expect(tree.toJSON()).toBeTruthy();
  });
});
