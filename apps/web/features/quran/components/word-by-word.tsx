import type { QuranWord } from "@repo/api/schemas/quran";

export function WordByWord({ words }: { words: QuranWord[] }) {
  return (
    <div
      dir="rtl"
      className="flex flex-wrap gap-x-4 gap-y-3"
      data-testid="word-by-word"
    >
      {words.map((w) => (
        <span key={w.position} className="flex flex-col items-center text-center">
          <span className="font-quran text-2xl leading-loose">{w.arabic}</span>
          {w.glossEn ? (
            <span className="text-text-2 text-xs" dir="ltr">
              {w.glossEn}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
