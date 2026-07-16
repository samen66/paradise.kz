import { InStockChip } from "@/components/InStockChip";

export function Inactive() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InStockChip searchParams={{ q: "диван" }} pathname="/catalog/divany" />
    </div>
  );
}

export function Active() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InStockChip searchParams={{ in_stock: "1", q: "диван" }} pathname="/catalog/divany" />
    </div>
  );
}

export function InFilterRow() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InStockChip searchParams={{ in_stock: "1" }} pathname="/catalog" />
      <span className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink">
        Диваны
      </span>
      <span className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink">
        До 400 000 ₸
      </span>
    </div>
  );
}
