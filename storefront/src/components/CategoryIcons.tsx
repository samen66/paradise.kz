import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/types";
import { useLocale } from "next-intl";
import { tValue } from "@/lib/format";

const ICONS: Record<string, string> = {
  gostinaya: "🛋️",
  spalnya: "🛏️",
  kuhnya: "🍽️",
  ofis: "🖥️",
  divany: "🛋️",
  kresla: "🪑",
  krovati: "🛏️",
  shkafy: "🗄️",
  komody: "🗄️",
  stoly: "🪑",
  stulya: "🪑",
  "tumby-pod-tv": "📺",
  "ofisnye-kresla": "💺",
  default: "🏠",
};

export function CategoryIcons({ categories }: { categories: Category[] }) {
  const locale = useLocale();
  return (
    <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide [mask-image:linear-gradient(to_right,black_90%,transparent_100%)] pr-[10%]">
      {categories.map((category) => {
        const icon = ICONS[category.slug] || ICONS.default;
        
        return (
          <Link
            key={category.id}
            href={`/catalog/${category.slug}`}
            className="group flex w-24 sm:w-28 flex-shrink-0 flex-col items-center gap-3 snap-start"
          >
            <div className="grid aspect-square w-full place-items-center rounded-full bg-white text-3xl sm:text-4xl transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-md border border-line/50">
              {icon}
            </div>
            <span className="line-clamp-2 text-center text-sm font-medium text-ink">
              {tValue(category.name, locale)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
