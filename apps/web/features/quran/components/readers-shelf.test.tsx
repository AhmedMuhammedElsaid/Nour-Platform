import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { QuranReciter } from "@repo/api/schemas/quran";

// Translations echo the key so we can assert against stable text.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}));

const loadQueue = vi.fn();
vi.mock("@repo/ui/blocks/player-context", () => ({
  usePlayer: () => ({ loadQueue }),
}));

// next/image → bare img (drop fill/unoptimized/sizes so React doesn't warn).
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ReadersShelf } from "./readers-shelf";

const RECITERS: QuranReciter[] = [
  {
    slug: "alafasy",
    name: "Mishary Alafasy",
    arabicName: "مشاري العفاسي",
    audioBase: "https://everyayah.com/data/Alafasy_128kbps/",
  },
  {
    slug: "qatami",
    name: "Nasser Al Qatami",
    audioBase: "https://everyayah.com/data/Nasser_Alqatami_128kbps/",
  },
];

const PREFS_KEY = "nour.quran.prefs";

afterEach(() => {
  window.localStorage.clear();
  push.mockClear();
  loadQueue.mockClear();
  vi.unstubAllGlobals();
});

describe("ReadersShelf", () => {
  it("renders nothing when there are no reciters", () => {
    const { container } = render(<ReadersShelf reciters={[]} locale="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each reader's name (Latin in en locale)", () => {
    render(<ReadersShelf reciters={RECITERS} locale="en" />);
    expect(screen.getByText("Mishary Alafasy")).toBeInTheDocument();
    expect(screen.getByText("Nasser Al Qatami")).toBeInTheDocument();
  });

  it("prefers arabicName in the ar locale, falls back to name", () => {
    render(<ReadersShelf reciters={RECITERS} locale="ar" />);
    expect(screen.getByText("مشاري العفاسي")).toBeInTheDocument();
    // qatami has no arabicName → falls back to its Latin name
    expect(screen.getByText("Nasser Al Qatami")).toBeInTheDocument();
  });

  it("selecting a reader writes reciterSlug to prefs, plays Al-Fatiha in the background, and opens the surah list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ayahs: [
              { ayahInSurah: 1, audioUrl: "https://everyayah.com/1.mp3" },
              { ayahInSurah: 2, audioUrl: "https://everyayah.com/2.mp3" },
            ],
          }),
      }),
    );

    render(<ReadersShelf reciters={RECITERS} locale="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Mishary Alafasy" }));

    const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}");
    expect(saved.reciterSlug).toBe("alafasy");
    expect(fetch).toHaveBeenCalledWith("/api/v1/quran/surah/1?reciter=alafasy");
    await waitFor(() =>
      expect(loadQueue).toHaveBeenCalledWith(
        [
          expect.objectContaining({ id: "quran:1:1", mediaUrl: "https://everyayah.com/1.mp3" }),
          expect.objectContaining({ id: "quran:1:2", mediaUrl: "https://everyayah.com/2.mp3" }),
        ],
        0,
      ),
    );
    // No autoplay query param — playback comes from the shared player, not the reader.
    expect(push).toHaveBeenCalledWith("/quran");
  });
});
