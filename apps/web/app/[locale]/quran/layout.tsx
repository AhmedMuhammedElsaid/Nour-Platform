import type { ReactNode } from "react";
import { Amiri_Quran } from "next/font/google";

// Uthmani mushaf face for Quran ayah text (single weight). Loaded in this
// segment only — it is used nowhere outside /quran/*, and loading it in the
// root locale layout preloaded its woff2 on every route. Exposed as
// --font-quran (the name the `@theme inline` bridge in packages/ui expects)
// on a wrapper element, so `font-quran` resolves to Amiri inside this subtree
// and to the tokens.css fallback stack everywhere else.
const fontQuran = Amiri_Quran({
  subsets: ["arabic"],
  weight: ["400"],
  display: "swap",
  variable: "--font-quran",
});

export default function QuranLayout({ children }: { children: ReactNode }) {
  return <div className={fontQuran.variable}>{children}</div>;
}
