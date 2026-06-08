import { ScrollView } from "react-native";

import { Chip } from "@/components/ui/chip";

export type CategoryPill = { id: string; slug: string; name: string };

export type CategoryPillsProps = {
  categories: CategoryPill[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  allLabel: string;
};

// Horizontally scrolling category filter. Tapping a pill filters the grid
// client-side (Phase 4); ?category= URL parity lands in Phase 5.
export function CategoryPills({ categories, activeId, onSelect, allLabel }: CategoryPillsProps) {
  if (categories.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-2 px-1 py-1"
    >
      <Chip label={allLabel} active={activeId === null} onPress={() => onSelect(null)} />
      {categories.map((cat) => (
        <Chip
          key={cat.id}
          label={cat.name}
          active={activeId === cat.id}
          onPress={() => onSelect(cat.id)}
        />
      ))}
    </ScrollView>
  );
}
