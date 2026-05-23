import base from "@repo/eslint-config/base.mjs";

export default [
  ...base,
  {
    // Service tests fabricate lean Mongo docs and mock module exports; the
    // `any` escape hatch keeps fixture builders concise without weakening
    // production code, which still has `no-explicit-any: error`.
    files: ["src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Auth entry files use a triple-slash reference to force-load the
    // next-auth module augmentation (`role` on Session/User/JWT). A side-effect
    // import would be silently stripped by IDE "organize imports" actions; the
    // reference directive is the canonical, IDE-resistant alternative.
    files: ["src/auth/index.ts", "src/auth/config.edge.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
];
