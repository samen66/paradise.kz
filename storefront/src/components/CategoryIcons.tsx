import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/types";

const ICONS: Record<string, string> = {
  sofa: "🛋️",
  bed: "🛏️",
  chair: "🪑",
  storage: "🗄️",
  table: "🪑",
  default: "🏠",
};

export function CategoryIcons({ categories }: { categories: Category[] }) {
  return (
    <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
      {categories.map((category) => {
        const icon = ICONS[category.slug] || ICONS.default;
        
        return (
          <Link
            key={category.id}
            href={`/catalog/${category.slug}`}
            className="group flex w-28 sm:w-32 flex-shrink-0 flex-col items-center gap-3 snap-start"
          >
            <div className="grid aspect-square w-full place-items-center rounded-2xl bg-card text-3xl sm:text-4xl transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-panel group-hover:shadow-sm">
              {icon}
            </div>
            <span className="line-clamp-2 text-center text-sm font-medium text-ink">
              {category.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
