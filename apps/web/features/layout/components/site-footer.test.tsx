import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => "en",
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { DEVELOPER_CONTACT } from "@repo/shared-core/developer";

import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("renders the developer name, title and every contact link", async () => {
    // Async server component: await it to get the element tree, then render.
    render(await SiteFooter());

    expect(screen.getByText(DEVELOPER_CONTACT.name.en)).toBeInTheDocument();
    expect(screen.getByText(DEVELOPER_CONTACT.title.en)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "linkedin" })).toHaveAttribute(
      "href",
      DEVELOPER_CONTACT.links.linkedin,
    );
    expect(screen.getByRole("link", { name: "github" })).toHaveAttribute(
      "href",
      DEVELOPER_CONTACT.links.github,
    );
    expect(screen.getByRole("link", { name: "portfolio" })).toHaveAttribute(
      "href",
      DEVELOPER_CONTACT.links.portfolio,
    );
    expect(screen.getByRole("link", { name: "email" })).toHaveAttribute(
      "href",
      `mailto:${DEVELOPER_CONTACT.email}`,
    );
    expect(screen.getByRole("link", { name: "phone" })).toHaveAttribute(
      "href",
      `tel:${DEVELOPER_CONTACT.phone}`,
    );
  });

  it("renders the tagline and both column headings", async () => {
    render(await SiteFooter());

    expect(screen.getByText("tagline")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "explore", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "contact", level: 2 }),
    ).toBeInTheDocument();
  });

  it("mirrors the header's five nav routes", async () => {
    render(await SiteFooter());

    const explore = screen.getByRole("navigation", { name: "explore" });
    const hrefs = Array.from(explore.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );

    expect(hrefs).toEqual([
      "/quran",
      "/radio",
      "/adhkar",
      "/prayer-times",
      "/qibla",
    ]);
  });

  it("renders the privacy link and the copyright year", async () => {
    render(await SiteFooter());

    expect(screen.getByRole("link", { name: "privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    // The mocked `t` echoes the key, so the year interpolation isn't visible —
    // asserting the key renders is enough to catch the block going missing.
    expect(screen.getByText("copyright")).toBeInTheDocument();
  });

  it("opens external profiles in a new tab but keeps mailto/tel in place", async () => {
    render(await SiteFooter());

    expect(screen.getByRole("link", { name: "github" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "email" })).not.toHaveAttribute(
      "target",
    );
  });
});
