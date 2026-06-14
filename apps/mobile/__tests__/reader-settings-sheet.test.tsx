import "@/lib/i18n"; // initialise i18next so labels resolve (default: en)
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ReaderSettingsSheet } from "@/features/quran/components/reader-settings-sheet";
import { DEFAULT_QURAN_PREFS } from "@/lib/device-local";

function renderSheet(onChange = jest.fn(), onClose = jest.fn()) {
  render(
    <ReaderSettingsSheet
      open
      onClose={onClose}
      prefs={DEFAULT_QURAN_PREFS}
      onChange={onChange}
      editions={[]}
      reciters={[]}
    />,
  );
  return { onChange, onClose };
}

describe("ReaderSettingsSheet — Save/Cancel staging (point 16)", () => {
  it("does NOT apply a staged change until Save is pressed", () => {
    const { onChange, onClose } = renderSheet();

    // Toggle a pref — this only mutates the local draft, not the committed prefs.
    fireEvent(screen.getByLabelText("Show translation"), "valueChange", false);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Save"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showTranslation: false }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("discards staged changes on Cancel", () => {
    const { onChange, onClose } = renderSheet();

    fireEvent(screen.getByLabelText("Show translation"), "valueChange", false);
    fireEvent.press(screen.getByText("Cancel"));

    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
