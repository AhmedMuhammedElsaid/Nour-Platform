import "@/lib/i18n"; // initialise i18next so labels resolve (default: en)
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BISMILLAH_UTHMANI } from "@repo/shared-core/quran/basmala";

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

describe("ReaderSettingsSheet — Layout toggle (Mushaf page view)", () => {
  it("does NOT apply the Mushaf layout pill until Save is pressed", () => {
    const { onChange } = renderSheet();

    fireEvent.press(screen.getByText("Mushaf"));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Save"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ layout: "mushaf" }),
    );
  });

  it("discards a staged Mushaf pill on Cancel", () => {
    const { onChange, onClose } = renderSheet();

    fireEvent.press(screen.getByText("Mushaf"));
    fireEvent.press(screen.getByText("Cancel"));

    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

// The live preview (owner-picked: B1's grouped cards + B3's live Bismillah
// sample, cloned onto B1). It reads the DRAFT, so — unlike every other
// setting here — its own restyle is NOT staged behind Save; only the
// COMMITTED reader is.
describe("ReaderSettingsSheet — live preview (B3 clone onto B1)", () => {
  it("scales the preview's Bismillah immediately when font size changes, before Save", () => {
    renderSheet();
    const before = screen.getByText(BISMILLAH_UTHMANI).props.style.fontSize;

    fireEvent.press(screen.getByLabelText("Larger text"));

    const after = screen.getByText(BISMILLAH_UTHMANI).props.style.fontSize;
    expect(after).toBeGreaterThan(before);
  });

  it("shows/hides the preview's translation line immediately when the toggle flips, before Save", () => {
    renderSheet(); // DEFAULT_QURAN_PREFS.showTranslation is true
    expect(
      screen.getByText("In the name of Allah, the Most Gracious, the Most Merciful."),
    ).toBeTruthy();

    fireEvent(screen.getByLabelText("Show translation"), "valueChange", false);

    expect(
      screen.queryByText("In the name of Allah, the Most Gracious, the Most Merciful."),
    ).toBeNull();
  });

  it("never commits the previewed font size on Cancel", () => {
    const { onChange, onClose } = renderSheet();

    fireEvent.press(screen.getByLabelText("Larger text"));
    fireEvent.press(screen.getByText("Cancel"));

    // The preview restyled live (previous test), but Cancel must still leave
    // the committed prefs — and therefore the actual reader — untouched.
    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
