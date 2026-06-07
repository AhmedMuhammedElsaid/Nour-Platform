export function TranslationBlock({
  text,
  dir,
}: {
  text: string;
  dir: "rtl" | "ltr";
}) {
  return (
    <p
      dir={dir}
      className="text-text-2 mt-2 text-base leading-relaxed"
      data-testid="translation"
    >
      {text}
    </p>
  );
}
