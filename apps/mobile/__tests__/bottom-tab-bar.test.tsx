import { fireEvent, render, screen } from "@testing-library/react-native";

import "@/lib/i18n"; // initialise i18next so nav labels resolve (default: en)
import { BottomTabBar } from "@/components/bottom-tab-bar";

// `mock`-prefixed names are allowed inside a hoisted jest.mock factory.
let mockPathname = "/";
const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate }),
  usePathname: () => mockPathname,
}));

describe("BottomTabBar", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockPathname = "/";
  });

  it("renders all five tabs", () => {
    render(<BottomTabBar bottomInset={0} />);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    for (const label of ["Home", "Quran", "Adhkar", "Prayer Times", "Downloads"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it("marks the tab matching the current pathname as selected", () => {
    mockPathname = "/quran";
    render(<BottomTabBar bottomInset={0} />);
    expect(screen.getByLabelText("Quran").props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText("Home").props.accessibilityState.selected).toBe(false);
  });

  it("renders and keeps the right tab active on a nested detail route", () => {
    mockPathname = "/quran/2";
    render(<BottomTabBar bottomInset={0} />);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByLabelText("Quran").props.accessibilityState.selected).toBe(true);
  });

  it("navigates to a tab's route when an inactive tab is pressed", () => {
    render(<BottomTabBar bottomInset={0} />);
    fireEvent.press(screen.getByLabelText("Adhkar"));
    expect(mockNavigate).toHaveBeenCalledWith("/adhkar");
  });

  it("does not re-navigate when the already-active tab is pressed", () => {
    render(<BottomTabBar bottomInset={0} />);
    fireEvent.press(screen.getByLabelText("Home"));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
