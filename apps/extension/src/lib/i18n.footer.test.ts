import { describe, expect, it } from "vitest";

import { translate } from "./i18n";

// The BrandedFooter renders these keys; a missing translation would silently fall
// back to Arabic (or the raw key), so guard both catalogs explicitly.
const FOOTER_KEYS = [
  "footer.builtBy",
  "footer.contact",
  "footer.linkedin",
  "footer.github",
  "footer.portfolio",
  "footer.email",
  "footer.phone",
] as const;

describe("footer i18n", () => {
  for (const locale of ["ar", "en"] as const) {
    it(`resolves every footer key for ${locale}`, () => {
      for (const key of FOOTER_KEYS) {
        const value = translate(locale, key);
        // A real translation, not the untranslated key echoed back.
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
