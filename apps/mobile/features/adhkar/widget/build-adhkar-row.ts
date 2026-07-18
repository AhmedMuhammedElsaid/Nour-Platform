// Adhkar row builder for the OS home-screen widget (home_widget_plan.md §5.7).
// Deliberately minimal per the owner's decision (plan §1): a static label +
// icon key, no daily-dhikr text fetch/truncation. Pure, no I/O.

const ADHKAR_LABEL: Record<"ar" | "en", string> = { ar: "الأذكار", en: "Adhkar" };

export type AdhkarRowResult = {
  label: string;
  iconKey: "adhkar";
};

export function buildAdhkarRow(locale: "ar" | "en"): AdhkarRowResult {
  return { label: ADHKAR_LABEL[locale], iconKey: "adhkar" };
}
