import { Badge } from "@/components/ui/Badge";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">Новинка</Badge>
      <Badge variant="mint">В наличии</Badge>
      <Badge variant="sale">-20%</Badge>
      <Badge variant="outline">Хит продаж</Badge>
    </div>
  );
}

export function OnCard() {
  return (
    <div className="flex max-w-xs flex-col gap-2 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <Badge variant="sale">Акция</Badge>
        <Badge variant="mint">Есть на складе</Badge>
      </div>
      <p className="font-display text-sm font-semibold text-ink">
        Диван Milan прямой, 3-местный
      </p>
      <p className="text-sm text-muted">389 900 ₸</p>
    </div>
  );
}

export function LongText() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">Скидка действует до 31 июля</Badge>
      <Badge variant="outline">Бесплатная доставка по Алматы</Badge>
    </div>
  );
}
