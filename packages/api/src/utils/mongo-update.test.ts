import { describe, expect, it } from "vitest";

import { flattenLocaleUpdate } from "./mongo-update";

describe("flattenLocaleUpdate", () => {
  it("expands a partial locale sub-object into dot-paths (so $set merges)", () => {
    const result = flattenLocaleUpdate({ ar: { title: "عنوان" } });

    expect(result).toEqual({ "ar.title": "عنوان" });
    // The bare `ar` key must NOT survive — that is the clobber we are fixing.
    expect(result).not.toHaveProperty("ar");
  });

  it("expands both locales and every sub-field", () => {
    const result = flattenLocaleUpdate({
      ar: { title: "عنوان", slug: "slug-ar", description: "وصف" },
      en: { title: "Title", slug: "slug-en" },
    });

    expect(result).toEqual({
      "ar.title": "عنوان",
      "ar.slug": "slug-ar",
      "ar.description": "وصف",
      "en.title": "Title",
      "en.slug": "slug-en",
    });
  });

  it("passes through non-locale keys untouched", () => {
    const result = flattenLocaleUpdate({
      status: "published",
      categoryIds: ["a", "b"],
      coverMediaId: "m1",
      order: 3,
    });

    expect(result).toEqual({
      status: "published",
      categoryIds: ["a", "b"],
      coverMediaId: "m1",
      order: 3,
    });
  });

  it("mixes locale sub-objects and top-level keys", () => {
    const result = flattenLocaleUpdate({
      ar: { title: "ع" },
      status: "draft",
    });

    expect(result).toEqual({ "ar.title": "ع", status: "draft" });
  });

  it("treats an empty locale object as a no-op (cannot blank a sub-object)", () => {
    expect(flattenLocaleUpdate({ ar: {} })).toEqual({});
  });

  it("does not expand arrays or null values that happen to sit under other keys", () => {
    const result = flattenLocaleUpdate({ categoryIds: ["x"], coverMediaId: null });

    expect(result).toEqual({ categoryIds: ["x"], coverMediaId: null });
  });
});
