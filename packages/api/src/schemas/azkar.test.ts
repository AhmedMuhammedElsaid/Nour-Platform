import { describe, it, expect } from "vitest";
import {
  dhikrItemSchema,
  azkarCreateInputSchema,
  azkarUpdateInputSchema,
} from "./azkar";

describe("azkar schemas", () => {
  it("accepts a minimal dhikr item (ar + repeat only)", () => {
    const parsed = dhikrItemSchema.parse({ ar: "سبحان الله", repeat: 3 });
    expect(parsed.repeat).toBe(3);
  });

  it("rejects repeat < 1", () => {
    expect(() => dhikrItemSchema.parse({ ar: "x", repeat: 0 })).toThrow();
  });

  it("accepts a full create input with one item", () => {
    const parsed = azkarCreateInputSchema.parse({
      kind: "morning",
      ar: { title: "أذكار الصباح" },
      en: { title: "Morning Adhkar" },
      items: [{ ar: "سبحان الله وبحمده", repeat: 100, en: "Glory be to Allah" }],
    });
    expect(parsed.status).toBe("draft"); // default
    expect(parsed.items).toHaveLength(1);
  });

  it("requires at least one item on create", () => {
    expect(() =>
      azkarCreateInputSchema.parse({
        kind: "morning",
        ar: { title: "x" },
        en: { title: "y" },
        items: [],
      }),
    ).toThrow();
  });

  it("update input is fully partial", () => {
    expect(() => azkarUpdateInputSchema.parse({})).not.toThrow();
    const parsed = azkarUpdateInputSchema.parse({ status: "published" });
    expect(parsed.status).toBe("published");
  });
});
