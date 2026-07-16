import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";

export function Left() {
  return (
    <Drawer open onClose={() => {}} side="left" title="Каталог">
      <ul className="flex flex-col divide-y divide-line text-sm">
        <li className="py-3 font-medium">Гостиная</li>
        <li className="py-3 font-medium">Спальня</li>
        <li className="py-3 font-medium">Кухня</li>
        <li className="py-3 font-medium">Офис</li>
      </ul>
    </Drawer>
  );
}

export function Right() {
  return (
    <Drawer open onClose={() => {}} side="right" title="Корзина">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Диван Milan прямой, 3-местный</span>
          <span className="font-medium">389 900 ₸</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Кресло офисное Ergo Pro</span>
          <span className="font-medium">128 000 ₸</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-line pt-4 font-display text-base font-semibold">
          <span>Итого</span>
          <span>517 900 ₸</span>
        </div>
        <Button variant="primary" className="w-full">
          Оформить заказ
        </Button>
      </div>
    </Drawer>
  );
}

export function Bottom() {
  return (
    <Drawer open onClose={() => {}} side="bottom" title="Сортировка">
      <ul className="flex flex-col divide-y divide-line text-sm">
        <li className="py-3 font-semibold text-ink">По популярности</li>
        <li className="py-3 text-muted">Сначала дешевле</li>
        <li className="py-3 text-muted">Сначала дороже</li>
        <li className="py-3 text-muted">Новинки</li>
      </ul>
    </Drawer>
  );
}
