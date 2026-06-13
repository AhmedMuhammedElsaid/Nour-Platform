import { fireEvent, render, screen } from "@testing-library/react-native";

import "@/lib/i18n"; // initialise i18next so nav labels resolve (default: en)
import { BottomTabBar, TAB_ROOTS, isTabRoot } from "@/components/bottom-tab-bar";

// `mock`-prefixed names are allowed inside a hoisted jest.mock factory.
let mockPathname = "/";
const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate }),
  usePathname: () => mockPathname,
}));

describe("isTabRoot", () => {
  it("matches the five top-level destinations (incl. trailing slash)", () => {
    for (const route of TAB_ROOTS) expect(isTabRoot(route)).toBe(true);
    expect(isTabRoot("/quran/")).toBe(true);
  });

  it("hides on deeper detail routes", () => {
    expect(isTabRoot("/quran/reader")).toBe(false);
    expect(isTabRoot("/playlist/abc")).toBe(false);
    expect(isTabRoot("/adhkar/morning")).toBe(false);
  });
});

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
