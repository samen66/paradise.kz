import { CategoryIcons } from "@/components/CategoryIcons";
import type { Category } from "@/lib/types";

// CategoryIcons' internal ICONS map keys on category.slug ("sofa", "bed",
// "chair", "storage", "table" -> emoji, anything else -> a house default).
// The shared sampleCategories in sample-data.ts use Russian slugs that don't
// match those keys, so we author a small local fixture here with slugs that
// DO match, to exercise the component's real icon-variety axis.
const iconMatchedCategories: Category[] = [
  { id: 12, name: "Диваны", slug: "sofa", parent_id: null },
  { id: 16, name: "Кровати", slug: "bed", parent_id: null },
  { id: 22, name: "Стулья", slug: "chair", parent_id: null },
  { id: 18, name: "Комоды", slug: "storage", parent_id: null },
  { id: 21, name: "Столы", slug: "table", parent_id: null },
];

const unmatchedCategories: Category[] = [
  { id: 40, name: "Освещение", slug: "osveshchenie", parent_id: null },
  { id: 41, name: "Текстиль", slug: "tekstil", parent_id: null },
  { id: 42, name: "Декор", slug: "dekor", parent_id: null },
];

export function AllIcons() {
  return (
    <div className="max-w-4xl bg-surface p-6">
      <CategoryIcons categories={iconMatchedCategories} />
    </div>
  );
}

export function DefaultFallback() {
  return (
    <div className="max-w-4xl bg-surface p-6">
      <CategoryIcons categories={unmatchedCategories} />
    </div>
  );
}
