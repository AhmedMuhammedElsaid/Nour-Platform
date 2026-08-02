const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
  },
}));

import { goBackOrHome } from "@/lib/nav";

describe("goBackOrHome", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockClear();
  });

  it("pops history when a previous screen exists", () => {
    mockCanGoBack.mockReturnValue(true);
    goBackOrHome();
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("replaces with Home when there is nothing to pop", () => {
    mockCanGoBack.mockReturnValue(false);
    goBackOrHome();
    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(mockBack).not.toHaveBeenCalled();
  });
});
