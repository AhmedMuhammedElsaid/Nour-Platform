import { act, render } from "@testing-library/react-native";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";

// Initialize i18next so t() resolves real catalog strings, not raw keys.
import "@/lib/i18n";
import { useAdhkarQuickActions } from "@/features/prayer-times/hooks/use-adhkar-quick-actions";

function Harness() {
  useAdhkarQuickActions();
  return null;
}

// Flush the AsyncStorage settings-hydration promise chain.
const flush = () => act(async () => {});

describe("useAdhkarQuickActions", () => {
  beforeEach(() => {
    jest.mocked(QuickActions.setItems).mockClear();
    jest.mocked(useQuickActionRouting).mockClear();
  });

  it("registers Sabah and Masaa shortcuts with encoded reader hrefs", async () => {
    render(<Harness />);
    await flush();

    expect(QuickActions.setItems).toHaveBeenCalledTimes(1);
    const items = jest.mocked(QuickActions.setItems).mock.calls[0]![0]!;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "sabah",
      title: "أذكار الصباح",
      params: { href: `/adhkar/${encodeURIComponent("أذكار-الصباح")}` },
    });
    expect(items[1]).toMatchObject({
      id: "masaa",
      title: "أذكار المساء",
      params: { href: `/adhkar/${encodeURIComponent("أذكار-المساء")}` },
    });
  });

  it("enables quick-action tap routing", async () => {
    render(<Harness />);
    await flush();

    expect(useQuickActionRouting).toHaveBeenCalled();
  });

  it("does not set items before settings hydration", async () => {
    render(<Harness />);

    expect(QuickActions.setItems).not.toHaveBeenCalled();
    // Let hydration settle inside act() so React doesn't warn post-test.
    await flush();
  });
});
