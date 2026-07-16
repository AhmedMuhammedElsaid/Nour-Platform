import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Locale-aware Link → plain anchor for assertions.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AdhkarPreviewShelf } from "./adhkar-preview-shelf";
import type { Azkar } from "@repo/api/schemas/azkar";

function set(id: string, kind: Azkar["kind"], arTitle: string, enTitle: string): Azkar {
  return {
    id,
    kind,
    status: "published",
    order: 0,
    ar: { title: arTitle, slug: `${id}-ar` },
    en: { title: enTitle, slug: `${id}-en` },
    items: [{ ar: "ذكر", repeat: 3 }],
  } as Azkar;
}

const sixSets: Azkar[] = [
  set("1", "morning", "أذكار الصباح", "Morning Adhkar"),
  set("2", "evening", "أذكار المساء", "Evening Adhkar"),
  set("3", "other", "أذكار النوم", "Sleep Adhkar"),
  set("4", "other", "أذكار الإستيقاظ", "Waking Adhkar"),
  set("5", "other", "أذكار الصلاة", "Prayer Adhkar"),
  set("6", "other", "اذكار المسجد", "Mosque Adhkar"),
];

describe("AdhkarPreviewShelf", () => {
  it("renders only the first ADHKAR_PREVIEW_COUNT sets", () => {
    render(<AdhkarPreviewShelf sets={sixSets} locale="en" heading="Adhkar" exploreLabel="Explore more" />);
    expect(screen.getByText("Prayer Adhkar")).toBeInTheDocument();
    expect(screen.queryByText("Mosque Adhkar")).not.toBeInTheDocument();
  });

  it("links each card to that set's reader and Explore more to the list", () => {
    render(<AdhkarPreviewShelf sets={sixSets} locale="en" heading="Adhkar" exploreLabel="Explore more" />);
    expect(screen.getByText("Morning Adhkar").closest("a")).toHaveAttribute("href", "/adhkar/1-en");
    expect(screen.getByText("Explore more").closest("a")).toHaveAttribute("href", "/adhkar");
  });

  it("returns null when there are no published sets", () => {
    const { container } = render(
      <AdhkarPreviewShelf sets={[]} locale="en" heading="Adhkar" exploreLabel="Explore more" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
