import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next/headers before importing the component. `headers()` returns a
// Promise<ReadonlyHeaders>; the mock returns a plain object with `get`.
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: (key: string) => (key === "x-nonce" ? "test-nonce-abc" : null),
  }),
}));

import { JsonLd } from "./json-ld";

const sampleData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nour",
  url: "http://localhost:3000",
};

describe("JsonLd", () => {
  it("renders a script element with type application/ld+json", async () => {
    // Async server components: call the function directly and await the element.
    const element = await JsonLd({ data: sampleData });
    const { container } = render(element);

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
  });

  it("serialises the data object to valid JSON in the script body", async () => {
    const element = await JsonLd({ data: sampleData });
    const { container } = render(element);

    const script = container.querySelector('script[type="application/ld+json"]')!;
    const parsed = JSON.parse(script.innerHTML);
    expect(parsed["@type"]).toBe("Organization");
    expect(parsed["name"]).toBe("Nour");
  });

  it("applies the x-nonce from the request header", async () => {
    const element = await JsonLd({ data: sampleData });
    const { container } = render(element);

    const script = container.querySelector('script[type="application/ld+json"]')!;
    expect(script.getAttribute("nonce")).toBe("test-nonce-abc");
  });

  it("escapes < to prevent </script> breakout", async () => {
    const element = await JsonLd({
      data: { ...sampleData, name: "A </script> injection" },
    });
    const { container } = render(element);

    const script = container.querySelector('script[type="application/ld+json"]')!;
    expect(script.innerHTML).not.toContain("</script>");
    expect(script.innerHTML).toContain("\\u003c");
  });

  it("accepts an array of LD objects", async () => {
    const arr = [sampleData, { ...sampleData, "@type": "WebSite" }];
    const element = await JsonLd({ data: arr });
    const { container } = render(element);

    const script = container.querySelector('script[type="application/ld+json"]')!;
    const parsed = JSON.parse(script.innerHTML);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });
});
