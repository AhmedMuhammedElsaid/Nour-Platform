import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

import "@/lib/i18n"; // initialise i18next so footer labels resolve (test default: en)
import { DEVELOPER_CONTACT } from "@repo/shared-core/developer";
import { DeveloperFooter } from "@/components/developer-footer";

describe("DeveloperFooter", () => {
  it("renders the developer name and title", () => {
    render(<DeveloperFooter />);
    expect(screen.getByText(DEVELOPER_CONTACT.name.en)).toBeTruthy();
    expect(screen.getByText(DEVELOPER_CONTACT.title.en)).toBeTruthy();
  });

  it("opens each contact channel with the right URL", () => {
    const spy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined as never);
    render(<DeveloperFooter />);

    const cases: ReadonlyArray<readonly [string, string]> = [
      ["LinkedIn", DEVELOPER_CONTACT.links.linkedin],
      ["GitHub", DEVELOPER_CONTACT.links.github],
      ["Portfolio", DEVELOPER_CONTACT.links.portfolio],
      ["Email", `mailto:${DEVELOPER_CONTACT.email}`],
      ["Phone", `tel:${DEVELOPER_CONTACT.phone}`],
    ];

    for (const [label, url] of cases) {
      fireEvent.press(screen.getByLabelText(label));
      expect(spy).toHaveBeenCalledWith(url);
    }

    spy.mockRestore();
  });
});
