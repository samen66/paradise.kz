import { Button } from "@/components/ui/Button";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">В корзину</Button>
      <Button variant="secondary">Подробнее</Button>
      <Button variant="ghost">Отмена</Button>
      <Button variant="danger">Удалить</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Малая</Button>
      <Button size="md">Средняя</Button>
      <Button size="lg">Большая</Button>
    </div>
  );
}

export function States() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Обычная</Button>
      <Button loading>Загрузка</Button>
      <Button disabled>Недоступна</Button>
    </div>
  );
}
