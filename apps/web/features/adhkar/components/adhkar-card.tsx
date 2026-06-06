import { Link } from "@/i18n/navigation";
import { AdhkarCardProgress } from "./adhkar-card-progress";

type AzkarKind = "morning" | "evening" | "other";

const KIND_EMOJI: Record<AzkarKind, string> = {
  morning: "🌅",
  evening: "🌙",
  other: "📿",
};

interface AdhkarCardProps {
  id: string;
  kind: AzkarKind;
  title: string;
  slug: string;
  count: number;
  repeats: number[];
}

export function AdhkarCard({ id, kind, title, slug, count, repeats }: AdhkarCardProps) {
  const emoji = KIND_EMOJI[kind];

  return (
    <Link
      href={`/adhkar/${slug}`}
      className="group relative flex flex-col rounded-2xl border border-border bg-surface p-4 gap-3 hover:-translate-y-1 hover:z-10 hover:border-primary/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Emoji icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <span className="text-2xl select-none" aria-hidden="true">
          {emoji}
        </span>
      </div>

      {/* Title */}
      <h2 className="font-display text-base font-semibold leading-snug text-text group-hover:text-primary transition-colors">
        {title}
      </h2>

      {/* Item count badge */}
      <span className="self-start rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold px-2.5 py-0.5">
        {count} أذكار
      </span>

      {/* Daily progress — client island */}
      <AdhkarCardProgress setId={id} repeats={repeats} />
    </Link>
  );
}
